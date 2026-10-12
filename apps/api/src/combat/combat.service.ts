import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CombatResult,
  DEFENSES,
  GAME_CONSTANTS,
  MOON_DEFAULT_NAME,
  MOON_INITIAL_FIELDS,
  MissionType,
  SHIPS,
  SOLAR_SATELLITE_ID,
  moonChancePercent,
} from '@xnova/game-config';
import {
  computeCargoCapacity,
  distributeShipLosses,
  distributeLoot,
  fitCargo,
  mergeShipMaps,
  simulateCombat,
  splitLoot,
  type CombatResultSummary,
} from '@xnova/game-engine';
import { Prisma } from '@prisma/client';
import { lockPlanet } from '../common/atomic';
import { applyCombatToCommander, commanderBonusesFor, COMMANDER_DEATH_CHANCE } from '../fleet-commanders/commander-progress';
import { settleBeforeEnergyChange } from '../common/energy';
import { ServerConfigService } from '../server-config/server-config.service';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';

/** Retourne par resolveAttackMission quand un autre traitement a deja pris en charge la flotte. */
export const ALREADY_PROCESSED = Symbol('fleet-event-already-processed');

/** Flotte attaquante telle que lue en base (une seule pour une attaque, plusieurs pour une attaque groupée). */
/** Levée dans la transaction quand une flotte du combat a changé d'état entre-temps : rien n'est écrit. */
class AttackFleetsChanged extends Error {}

export interface AttackFleet {
  id: string;
  userId: string;
  mission: number;
  ships: unknown;
  cargo: unknown;
  startTime: Date;
  arrivalTime: Date;
  returnTime: Date | null;
  status: string;
  fromGalaxy: number;
  fromSystem: number;
  fromPosition: number;
  toGalaxy: number;
  toSystem: number;
  toPosition: number;
  toMoon?: boolean;
  commanderId?: string | null;
  groupId?: string | null;
}

interface CombatTechLevels {
  weapon: number;
  shield: number;
  armor: number;
  hyperspace: number;
}

@Injectable()
export class CombatService {
  constructor(
    private readonly database: DatabaseService,
    private readonly gameEvents: GameEventsGateway,
    private readonly serverConfig: ServerConfigService,
  ) {}

  /**
   * Resolve une mission d'attaque en simulant le combat complet.
   *
   * Etapes:
   * 1. Charge la cible et les flottes des deux camps.
   * 2. Calcule le combat (rapid fire, boucliers, coques).
   * 3. Determine les survivants et le butin possible.
   * 4. Met a jour la base (flottes, planetes, rapports).
   *
   * @param fleet - Flotte attaquante avec position et chargement.
   * @returns Rapport de combat cree ou null si pas de cible.
   */
  async resolveAttackMission(fleet: AttackFleet) {
    if (fleet.mission !== MissionType.ATTACK) {
      return null;
    }
    return this.resolveAttackFleets([fleet]);
  }

  /**
   * Attaque groupée (mission 2) : toutes les flottes du groupe qui arrivent ensemble combattent dans un seul
   * combat (chacune avec ses technologies et son commandant) ; butin partagé au prorata de la place libre.
   */
  async resolveGroupAttack(fleets: AttackFleet[]) {
    if (fleets.length === 0 || fleets.some((f) => f.mission !== MissionType.ACS_ATTACK)) {
      return null;
    }
    return this.resolveAttackFleets(fleets);
  }

  private async resolveAttackFleets(fleets: AttackFleet[]) {
    const fleet = fleets[0];
    const fleetIds = fleets.map((f) => f.id);
    const grouped = fleets.length > 1;

    const target = await this.database.planet.findFirst({
      where: {
        galaxy: fleet.toGalaxy,
        system: fleet.toSystem,
        position: fleet.toPosition,
        isMoon: fleet.toMoon ?? false,
      },
    });

    if (!target) {
      // Cible disparue : toutes les flottes rentrent (la prise en charge échoue si l'une est déjà traitée)
      const claimed = await this.database.fleet.updateMany({
        where: { id: grouped ? { in: fleetIds } : fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      return claimed.count === fleets.length ? null : ALREADY_PROCESSED;
    }

    const fleetShips = new Map(fleets.map((f) => [f.id, this.normalizeShipMap(f.ships)]));
    const attackerShips = mergeShipMaps([...fleetShips.values()]);
    const defenderShipRows = await this.database.ship.findMany({
      where: { planetId: target.id },
      select: { shipId: true, amount: true },
    });
    const defenderShips = defenderShipRows.reduce((acc, row) => {
      acc[row.shipId] = row.amount;
      return acc;
    }, {} as Record<number, number>);
    // Les défenses de la planète combattent avec la flotte stationnée (SCOPE-01)
    const defenderDefenseRows = await this.database.defense.findMany({
      // Les missiles du silo (502, 503) ne combattent pas : ils se règlent par leur propre frappe
      where: { planetId: target.id, amount: { gt: 0 }, defenseId: { lt: 500 } },
      select: { defenseId: true, amount: true },
    });
    const defenderDefenses = defenderDefenseRows.reduce((acc, row) => {
      acc[row.defenseId] = row.amount;
      return acc;
    }, {} as Record<number, number>);

    // Flottes alliées en maintien de position sur la cible : elles défendent avec elle (technologies de l'hôte)
    const holders = (
      await this.database.fleet.findMany({
        where: {
          status: 'holding',
          mission: MissionType.HOLD_POSITION,
          toGalaxy: fleet.toGalaxy,
          toSystem: fleet.toSystem,
          toPosition: fleet.toPosition,
          toMoon: target.isMoon,
        },
        select: { id: true, ships: true },
        orderBy: { id: 'asc' },
      })
    ).map((holder) => ({ id: holder.id, ships: this.normalizeShipMap(holder.ships) }));
    const defendingShips: Record<number, number> = { ...defenderShips };
    for (const holder of holders) {
      for (const [id, amount] of Object.entries(holder.ships)) {
        defendingShips[Number(id)] = (defendingShips[Number(id)] ?? 0) + Number(amount);
      }
    }

    const defenderTech = await this.getCombatTechLevels(target.userId);
    // Technologies de chaque attaquant (une lecture par joueur) et commandant de chaque flotte :
    // dégâts (Attaque), bouclier et coque (Défense), cargaison
    const techByUser = new Map<string, CombatTechLevels>();
    for (const f of fleets) {
      if (!techByUser.has(f.userId)) techByUser.set(f.userId, await this.getCombatTechLevels(f.userId));
    }
    const commanderByFleet = new Map<string, Awaited<ReturnType<typeof commanderBonusesFor>>>();
    for (const f of fleets) {
      commanderByFleet.set(f.id, await commanderBonusesFor(this.database, f.commanderId));
    }
    const techOf = (f: AttackFleet) => {
      const tech = techByUser.get(f.userId)!;
      const bonus = commanderByFleet.get(f.id)!;
      return {
        weapon: tech.weapon,
        shield: tech.shield,
        armor: tech.armor,
        weaponBonus: bonus.attack,
        shieldBonus: bonus.defense,
        armorBonus: bonus.defense,
      };
    };

    const combat = simulateCombat({
      attackerShips,
      defenderShips: { ...defendingShips, ...defenderDefenses },
      attackerTech: techOf(fleet),
      ...(grouped
        ? { attackerGroups: fleets.map((f) => ({ key: f.id, ships: fleetShips.get(f.id)!, tech: techOf(f) })) }
        : {}),
      defenderTech: {
        weapon: defenderTech.weapon,
        shield: defenderTech.shield,
        armor: defenderTech.armor,
      },
    });

    // Survivants de chaque flotte (le combat les rend par flotte pour une attaque groupée)
    const survivorsOf = new Map<string, Record<number, number>>(
      fleets.map((f) => [
        f.id,
        grouped ? combat.attackerGroupsRemaining?.[f.id] ?? {} : combat.attackerRemaining,
      ]),
    );
    const { shipLosses: totalShipLosses, defenseLosses } = this.splitDefenderLosses(
      combat.defenderLosses ?? {},
    );
    // Pertes réparties entre la planète hôte et les flottes alliées en maintien, au prorata de leurs vaisseaux
    const lossShares = distributeShipLosses(totalShipLosses, [
      { key: 'host', ships: defenderShips },
      ...holders.map((holder) => ({ key: holder.id, ships: holder.ships })),
    ]);
    const defenderShipLosses = lossShares.host ?? {};
    // Réparation : chaque défense détruite revient avec la probabilité DEFENSE_REPAIR_FACTOR
    const defenderRepaired = this.repairDefenses(defenseLosses);
    const maxLoot = {
      metal: Math.floor(target.metal * 0.5),
      crystal: Math.floor(target.crystal * 0.5),
      deuterium: Math.floor(target.deuterium * 0.5),
    };

    // Cargaison embarquée (GAME-03) : conservée dans la limite de la capacité des survivants de chaque flotte,
    // le surplus est perdu avec les vaisseaux détruits ; le butin n'occupe que la place libre (cumulée pour
    // une attaque groupée, puis partagée au prorata de la place libre de chaque flotte).
    const plans = fleets.map((f) => {
      const survivors = survivorsOf.get(f.id) ?? {};
      const total = this.countShips(survivors);
      const capacity =
        total > 0
          ? Math.floor(
              computeCargoCapacity(survivors, techByUser.get(f.userId)!.hyperspace) *
                (1 + commanderByFleet.get(f.id)!.cargo),
            )
          : 0;
      const { kept } = fitCargo(this.normalizeCargo(f.cargo), capacity);
      const free = Math.max(0, capacity - (kept.metal + kept.crystal + kept.deuterium));
      return {
        fleet: f,
        survivors,
        total,
        kept,
        free,
        update:
          total > 0
            ? { status: 'returning', ships: survivors }
            : { status: 'completed', ships: {}, cargo: {}, returnTime: null },
      };
    });
    const attackerTotal = plans.reduce((sum, plan) => sum + plan.total, 0);
    const freeCapacity = plans.reduce((sum, plan) => sum + plan.free, 0);

    const loot =
      combat.result === CombatResult.ATTACKER_WIN && attackerTotal > 0
        ? distributeLoot({ maxLoot, capacity: freeCapacity })
        : { metal: 0, crystal: 0, deuterium: 0 };

    // Resolution unique (ECO-04) : verrou de la cible, prise en charge atomique de la flotte,
    // puis rapport, butin et pertes dans la meme transaction.
    const resourceConfig = await this.serverConfig.getResourceConfig();
    // Participants d'une attaque groupée (une entrée par joueur) : vaisseaux engagés et pertes
    const attackerIds = [...new Set(fleets.map((f) => f.userId))];
    let participants: Prisma.InputJsonValue | undefined;
    if (grouped) {
      const users = await this.database.user.findMany({
        where: { id: { in: attackerIds } },
        select: { id: true, username: true },
      });
      participants = attackerIds.map((id) => {
        const mine = plans.filter((plan) => plan.fleet.userId === id);
        const ships = mergeShipMaps(mine.map((plan) => fleetShips.get(plan.fleet.id)!));
        const left = mergeShipMaps(mine.map((plan) => plan.survivors));
        const losses: Record<number, number> = {};
        for (const [shipId, count] of Object.entries(ships)) {
          const lost = Number(count) - (left[Number(shipId)] ?? 0);
          if (lost > 0) losses[Number(shipId)] = lost;
        }
        return { userId: id, username: users.find((u) => u.id === id)?.username ?? '', ships, losses };
      }) as Prisma.InputJsonValue;
    }
    const report = await this.database.$transaction(async (tx) => {
      await lockPlanet(tx, target.id);

      // Prise en charge de toutes les flottes : si l'une a changé entre-temps (rappel, autre worker), rien n'est écrit
      for (const plan of plans) {
        const claimed = await tx.fleet.updateMany({
          where: { id: plan.fleet.id, status: 'traveling' },
          data: { status: plan.update.status },
        });
        if (claimed.count !== 1) throw new AttackFleetsChanged();
      }
      // Le groupe d'attaque a fait son œuvre : on le supprime (les flottes gardent leur état, groupId repasse à null)
      const groupIds = [...new Set(fleets.map((f) => f.groupId).filter((id): id is string => !!id))];
      if (groupIds.length > 0) await tx.attackGroup.deleteMany({ where: { id: { in: groupIds } } });

      // Le butin ne peut pas depasser le stock reellement present au moment de l'ecriture
      const current = await tx.planet.findUniqueOrThrow({
        where: { id: target.id },
        select: { metal: true, crystal: true, deuterium: true },
      });
      const finalLoot = {
        metal: Math.max(0, Math.min(loot.metal, Math.floor(current.metal))),
        crystal: Math.max(0, Math.min(loot.crystal, Math.floor(current.crystal))),
        deuterium: Math.max(0, Math.min(loot.deuterium, Math.floor(current.deuterium))),
      };

      // Lune : un combat sur une planète peut en laisser une, selon les débris produits
      let moonCreated = false;
      if (!target.isMoon) {
        const chance = moonChancePercent(combat.debris.metal, combat.debris.crystal);
        if (chance > 0 && this.rollMoon(chance)) {
          const made = await tx.planet.createMany({
            data: [
              {
                userId: target.userId,
                name: MOON_DEFAULT_NAME,
                galaxy: fleet.toGalaxy,
                system: fleet.toSystem,
                position: fleet.toPosition,
                isMoon: true,
                planetType: 'moon',
                metal: 0,
                crystal: 0,
                deuterium: 0,
                fieldsMax: MOON_INITIAL_FIELDS,
                fieldsUsed: 0,
              },
            ],
            skipDuplicates: true,
          });
          moonCreated = made.count === 1;
        }
      }

      const reportData = this.buildReportData({
        moonCreated,
        attackerId: fleet.userId,
        defenderId: target.userId,
        attackerShips,
        defenderShips: defendingShips,
        defenderDefenses,
        defenderRepaired,
        combat,
        loot: finalLoot,
        location: {
          galaxy: fleet.toGalaxy,
          system: fleet.toSystem,
          position: fleet.toPosition,
        },
        participants,
      });
      const created = await tx.combatReport.create({ data: reportData });
      // Attaque groupée : chaque autre participant reçoit sa propre copie du rapport unifié
      for (const otherId of attackerIds.filter((id) => id !== fleet.userId)) {
        await tx.combatReport.create({ data: { ...reportData, attackerId: otherId } });
      }

      // Débris du combat : cumulés au champ de débris des coordonnées (recyclables)
      const debris = combat.debris;
      if (debris.metal > 0 || debris.crystal > 0) {
        await tx.debrisField.upsert({
          where: {
            galaxy_system_position: {
              galaxy: fleet.toGalaxy,
              system: fleet.toSystem,
              position: fleet.toPosition,
            },
          },
          update: { metal: { increment: debris.metal }, crystal: { increment: debris.crystal } },
          create: {
            galaxy: fleet.toGalaxy,
            system: fleet.toSystem,
            position: fleet.toPosition,
            metal: debris.metal,
            crystal: debris.crystal,
          },
        });
      }

      await tx.planet.update({
        where: { id: target.id },
        data: {
          metal: { decrement: finalLoot.metal },
          crystal: { decrement: finalLoot.crystal },
          deuterium: { decrement: finalLoot.deuterium },
        },
      });

      // Butin partagé au prorata de la place libre de chaque flotte (une seule flotte : tout lui revient)
      const shares = splitLoot(finalLoot, plans.map((plan) => plan.free));
      const enemyLossValue = this.lossValue(combat.defenderLosses ?? {});
      for (const [index, plan] of plans.entries()) {
        await tx.fleet.update({
          where: { id: plan.fleet.id },
          data:
            plan.total > 0
              ? {
                  ...plan.update,
                  cargo: {
                    metal: plan.kept.metal + shares[index].metal,
                    crystal: plan.kept.crystal + shares[index].crystal,
                    deuterium: plan.kept.deuterium + shares[index].deuterium,
                  },
                }
              : plan.update,
        });

        // Commandant de flotte : expérience du combat, ou mort si toute la flotte est détruite (10 %)
        if (plan.fleet.commanderId) {
          await applyCombatToCommander(tx, plan.fleet.commanderId, {
            enemyLossValue,
            fleetDestroyed: plan.total === 0,
            died: plan.total === 0 && this.rollCommanderDeath(),
          });
        }
      }

      // Satellites détruits : la production d'énergie baisse à partir de maintenant, pas rétroactivement
      const satellitesLost = Number(defenderShipLosses[SOLAR_SATELLITE_ID] ?? 0);
      if (satellitesLost > 0) {
        await settleBeforeEnergyChange(tx, target.id, resourceConfig, {
          satellitesDelta: -satellitesLost,
        });
      }

      // Pertes du defenseur en decrement : ne jamais ecraser une construction ou un envoi concurrent
      for (const [shipId, lost] of Object.entries(defenderShipLosses)) {
        const amount = Number(lost);
        if (!(amount > 0)) continue;
        const decremented = await tx.ship.updateMany({
          where: { planetId: target.id, shipId: Number(shipId), amount: { gte: amount } },
          data: { amount: { decrement: amount } },
        });
        if (decremented.count !== 1) {
          await tx.ship.updateMany({
            where: { planetId: target.id, shipId: Number(shipId) },
            data: { amount: 0 },
          });
        }
      }

      // Flottes en maintien : leurs pertes sortent de leur propre cargaison de vaisseaux
      for (const holder of holders) {
        const share = lossShares[holder.id] ?? {};
        if (Object.keys(share).length === 0) continue;
        const current = await tx.fleet.findUnique({
          where: { id: holder.id },
          select: { status: true, ships: true },
        });
        if (!current || current.status !== 'holding') continue;
        const remaining = this.normalizeShipMap(current.ships);
        for (const [id, lost] of Object.entries(share)) {
          remaining[Number(id)] = Math.max(0, (remaining[Number(id)] ?? 0) - Number(lost));
          if (remaining[Number(id)] === 0) delete remaining[Number(id)];
        }
        const alive = Object.values(remaining).some((n) => n > 0);
        await tx.fleet.update({
          where: { id: holder.id },
          data: alive
            ? { ships: remaining }
            : { status: 'completed', ships: {}, cargo: {}, returnTime: null, holdUntil: null },
        });
      }

      // Défenses perdues pour de bon = détruites moins réparées
      for (const [defenseId, destroyed] of Object.entries(defenseLosses)) {
        const amount = destroyed - (defenderRepaired[Number(defenseId)] ?? 0);
        if (!(amount > 0)) continue;
        const decremented = await tx.defense.updateMany({
          where: { planetId: target.id, defenseId: Number(defenseId), amount: { gte: amount } },
          data: { amount: { decrement: amount } },
        });
        if (decremented.count !== 1) {
          await tx.defense.updateMany({
            where: { planetId: target.id, defenseId: Number(defenseId) },
            data: { amount: 0 },
          });
        }
      }

      return created;
    }).catch((error: unknown) => {
      if (error instanceof AttackFleetsChanged) return null;
      throw error;
    });

    if (!report) return ALREADY_PROCESSED;

    for (const attackerId of attackerIds) {
      this.gameEvents.emitToUser(attackerId, 'combat:report', {
        reportId: report.id,
        result: report.result,
        opponentId: target.userId,
      });
    }

    this.gameEvents.emitToUser(target.userId, 'combat:report', {
      reportId: report.id,
      result: report.result,
      opponentId: fleet.userId,
    });

    return report;
  }

  /** Tirage de la mort du commandant d'une flotte détruite ; isolé pour pouvoir le forcer dans les tests. */
  protected rollCommanderDeath(): boolean {
    return Math.random() < COMMANDER_DEATH_CHANCE;
  }

  /** Valeur en métal et cristal des unités perdues (vaisseaux et défenses). */
  private lossValue(losses: Record<number, number>): number {
    let total = 0;
    for (const [id, count] of Object.entries(losses)) {
      const unit = SHIPS[Number(id)] ?? DEFENSES[Number(id)];
      if (unit) total += (unit.cost.metal + unit.cost.crystal) * Number(count || 0);
    }
    return total;
  }

  /** Tirage de la lune (chance en %) ; isolé pour pouvoir le forcer dans les tests. */
  protected rollMoon(chancePercent: number): boolean {
    return Math.random() * 100 < chancePercent;
  }

  async getReports(userId: string) {
    return this.database.combatReport.findMany({
      where: {
        OR: [{ attackerId: userId }, { defenderId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        attackerId: true,
        defenderId: true,
        result: true,
        createdAt: true,
      },
    });
  }

  async getReportById(reportId: string, userId: string) {
    const report = await this.database.combatReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Rapport introuvable');
    }

    if (report.attackerId !== userId && report.defenderId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    return report;
  }

  private normalizeCargo(raw: unknown) {
    const cargo = (raw ?? {}) as Record<string, unknown>;
    const read = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    };
    return { metal: read(cargo.metal), crystal: read(cargo.crystal), deuterium: read(cargo.deuterium) };
  }

  private buildReportData(params: {
    attackerId: string;
    defenderId: string;
    attackerShips: Record<number, number>;
    defenderShips: Record<number, number>;
    defenderDefenses: Record<number, number>;
    defenderRepaired: Record<number, number>;
    combat: CombatResultSummary;
    loot: { metal: number; crystal: number; deuterium: number };
    location: { galaxy: number; system: number; position: number };
    moonCreated: boolean;
    participants?: Prisma.InputJsonValue;
  }): Prisma.CombatReportCreateInput {
    return {
      ...(params.participants ? { participants: params.participants } : {}),
      moonCreated: params.moonCreated,
      attackerId: params.attackerId,
      defenderId: params.defenderId,
      attackerShips: params.attackerShips as Prisma.InputJsonValue,
      defenderShips: params.defenderShips as Prisma.InputJsonValue,
      defenderDefs: params.defenderDefenses as Prisma.InputJsonValue,
      defenderRepaired: params.defenderRepaired as Prisma.InputJsonValue,
      attackerLosses: params.combat.attackerLosses as Prisma.InputJsonValue,
      defenderLosses: params.combat.defenderLosses as Prisma.InputJsonValue,
      result: params.combat.result,
      rounds: params.combat.rounds,
      timeline: params.combat.timeline as unknown as Prisma.InputJsonValue,
      loot: params.loot as Prisma.InputJsonValue,
      debris: params.combat.debris as Prisma.InputJsonValue,
      galaxy: params.location.galaxy,
      system: params.location.system,
      position: params.location.position,
    };
  }

  /** Sépare les pertes du défenseur : vaisseaux (ids 2xx) et défenses (ids >= 400). */
  private splitDefenderLosses(losses: Record<number, number>) {
    const shipLosses: Record<number, number> = {};
    const defenseLosses: Record<number, number> = {};
    for (const [id, amount] of Object.entries(losses)) {
      (Number(id) >= 400 ? defenseLosses : shipLosses)[Number(id)] = Number(amount);
    }
    return { shipLosses, defenseLosses };
  }

  private repairDefenses(defenseLosses: Record<number, number>): Record<number, number> {
    const repaired: Record<number, number> = {};
    for (const [id, destroyed] of Object.entries(defenseLosses)) {
      let back = 0;
      for (let i = 0; i < destroyed; i += 1) {
        if (Math.random() < GAME_CONSTANTS.DEFENSE_REPAIR_FACTOR) back += 1;
      }
      if (back > 0) repaired[Number(id)] = back;
    }
    return repaired;
  }

  private normalizeShipMap(raw: unknown): Record<number, number> {
    if (!raw || typeof raw !== 'object') return {};
    return Object.entries(raw as Record<string, unknown>).reduce((acc, [shipIdRaw, countRaw]) => {
      const shipId = Number(shipIdRaw);
      const count = Math.max(0, Math.floor(Number(countRaw)));
      if (count > 0) {
        acc[shipId] = count;
      }
      return acc;
    }, {} as Record<number, number>);
  }

  private countShips(ships: Record<number, number>) {
    return Object.values(ships).reduce((sum, amount) => sum + amount, 0);
  }

  private async getCombatTechLevels(userId: string): Promise<CombatTechLevels> {
    const techRows = await this.database.technology.findMany({
      where: { userId, techId: { in: [109, 110, 111, 118] } },
      select: { techId: true, level: true },
    });

    const levels = new Map<number, number>();
    techRows.forEach((row) => levels.set(row.techId, row.level));

    return {
      weapon: levels.get(109) ?? 0,
      armor: levels.get(110) ?? 0,
      shield: levels.get(111) ?? 0,
      hyperspace: levels.get(118) ?? 0,
    };
  }
}
