import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CombatResult, GAME_CONSTANTS, MissionType } from '@xnova/game-config';
import {
  computeCargoCapacity,
  distributeLoot,
  fitCargo,
  simulateCombat,
  type CombatResultSummary,
} from '@xnova/game-engine';
import { Prisma } from '@prisma/client';
import { lockPlanet } from '../common/atomic';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';

/** Retourne par resolveAttackMission quand un autre traitement a deja pris en charge la flotte. */
export const ALREADY_PROCESSED = Symbol('fleet-event-already-processed');

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
  async resolveAttackMission(fleet: {
    id: string;
    userId: string;
    mission: number;
    ships: any;
    cargo: any;
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
  }) {
    if (fleet.mission !== MissionType.ATTACK) {
      return null;
    }

    const target = await this.database.planet.findFirst({
      where: {
        galaxy: fleet.toGalaxy,
        system: fleet.toSystem,
        position: fleet.toPosition,
      },
    });

    if (!target) {
      const claimed = await this.database.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      return claimed.count === 1 ? null : ALREADY_PROCESSED;
    }

    const attackerShips = this.normalizeShipMap(fleet.ships);
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
      where: { planetId: target.id, amount: { gt: 0 } },
      select: { defenseId: true, amount: true },
    });
    const defenderDefenses = defenderDefenseRows.reduce((acc, row) => {
      acc[row.defenseId] = row.amount;
      return acc;
    }, {} as Record<number, number>);

    const attackerTech = await this.getCombatTechLevels(fleet.userId);
    const defenderTech = await this.getCombatTechLevels(target.userId);

    const combat = simulateCombat({
      attackerShips,
      defenderShips: { ...defenderShips, ...defenderDefenses },
      attackerTech: {
        weapon: attackerTech.weapon,
        shield: attackerTech.shield,
        armor: attackerTech.armor,
      },
      defenderTech: {
        weapon: defenderTech.weapon,
        shield: defenderTech.shield,
        armor: defenderTech.armor,
      },
    });

    const attackerSurvivors = combat.attackerRemaining;
    const { shipLosses: defenderShipLosses, defenseLosses } = this.splitDefenderLosses(
      combat.defenderLosses ?? {},
    );
    // Réparation : chaque défense détruite revient avec la probabilité DEFENSE_REPAIR_FACTOR
    const defenderRepaired = this.repairDefenses(defenseLosses);
    const attackerTotal = this.countShips(attackerSurvivors);

    const maxLoot = {
      metal: Math.floor(target.metal * 0.5),
      crystal: Math.floor(target.crystal * 0.5),
      deuterium: Math.floor(target.deuterium * 0.5),
    };

    // Cargaison embarquée (GAME-03) : conservée dans la limite de la capacité des survivants,
    // le surplus est perdu avec les vaisseaux détruits ; le butin n'occupe que la place libre.
    const boarded = this.normalizeCargo(fleet.cargo);
    const capacity =
      attackerTotal > 0 ? computeCargoCapacity(attackerSurvivors, attackerTech.hyperspace) : 0;
    const { kept: keptCargo } = fitCargo(boarded, capacity);
    const freeCapacity = Math.max(
      0,
      capacity - (keptCargo.metal + keptCargo.crystal + keptCargo.deuterium),
    );

    const loot =
      combat.result === CombatResult.ATTACKER_WIN && attackerTotal > 0
        ? distributeLoot({ maxLoot, capacity: freeCapacity })
        : { metal: 0, crystal: 0, deuterium: 0 };

    const fleetUpdate =
      attackerTotal > 0
        ? {
            status: 'returning',
            ships: attackerSurvivors,
          }
        : {
            status: 'completed',
            ships: {},
            cargo: {},
            returnTime: null,
          };

    // Resolution unique (ECO-04) : verrou de la cible, prise en charge atomique de la flotte,
    // puis rapport, butin et pertes dans la meme transaction.
    const report = await this.database.$transaction(async (tx) => {
      await lockPlanet(tx, target.id);

      const claimed = await tx.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: fleetUpdate.status },
      });
      if (claimed.count !== 1) return null;

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

      const created = await tx.combatReport.create({
        data: this.buildReportData({
          attackerId: fleet.userId,
          defenderId: target.userId,
          attackerShips,
          defenderShips,
          defenderDefenses,
          defenderRepaired,
          combat,
          loot: finalLoot,
          location: {
            galaxy: fleet.toGalaxy,
            system: fleet.toSystem,
            position: fleet.toPosition,
          },
        }),
      });

      await tx.planet.update({
        where: { id: target.id },
        data: {
          metal: { decrement: finalLoot.metal },
          crystal: { decrement: finalLoot.crystal },
          deuterium: { decrement: finalLoot.deuterium },
        },
      });

      await tx.fleet.update({
        where: { id: fleet.id },
        data:
          attackerTotal > 0
            ? {
                ...fleetUpdate,
                cargo: {
                  metal: keptCargo.metal + finalLoot.metal,
                  crystal: keptCargo.crystal + finalLoot.crystal,
                  deuterium: keptCargo.deuterium + finalLoot.deuterium,
                },
              }
            : fleetUpdate,
      });

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
    });

    if (!report) return ALREADY_PROCESSED;

    this.gameEvents.emitToUser(fleet.userId, 'combat:report', {
      reportId: report.id,
      result: report.result,
      opponentId: target.userId,
    });

    this.gameEvents.emitToUser(target.userId, 'combat:report', {
      reportId: report.id,
      result: report.result,
      opponentId: fleet.userId,
    });

    return report;
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
  }): Prisma.CombatReportCreateInput {
    return {
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

  private normalizeShipMap(raw: any): Record<number, number> {
    if (!raw || typeof raw !== 'object') return {};
    return Object.entries(raw).reduce((acc, [shipIdRaw, countRaw]) => {
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
