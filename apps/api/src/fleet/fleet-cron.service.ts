import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EXPEDITION_POSITION, MissionType, SHIPS, depotSupply, holdFuelPerHour, holdSeconds } from '@xnova/game-config';
import { BossService } from '../boss/boss.service';
import { lockPlanet } from '../common/atomic';
import { ServerConfigService } from '../server-config/server-config.service';
import { ALREADY_PROCESSED, CombatService } from '../combat/combat.service';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ColonizationService } from './colonization.service';
import { ExpeditionService } from './expedition.service';
import { SpyService } from './spy.service';
import { MonitoredCron } from '../supervision/cron-registry';

@Injectable()
export class FleetCronService {
  private readonly logger = new Logger(FleetCronService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly gameEvents: GameEventsGateway,
    private readonly combatService: CombatService,
    private readonly spyService: SpyService,
    private readonly colonizationService: ColonizationService,
    private readonly expeditionService: ExpeditionService,
    private readonly serverConfig: ServerConfigService,
    private readonly boss: BossService,
  ) {}

  /**
   * Vérifie toutes les 10 secondes les flottes arrivées et de retour
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  @MonitoredCron('fleet-status', 10000)
  async handleFleetStatus() {
    try {
      await this.processArrivals();
      await this.processHolds();
      await this.processReturns();
    } catch (error) {
      this.logger.error('Error in fleet cron job:', error);
    }
  }

  private async processArrivals() {
    // Groupes d'attaque abandonnés (toutes les flottes rappelées) : nettoyés une heure après l'arrivée prévue
    await this.database.attackGroup.deleteMany({ where: { arrivalTime: { lt: new Date(Date.now() - 3_600_000) } } });
    const fleets = await this.database.fleet.findMany({
      where: {
        status: 'traveling',
        arrivalTime: { lte: new Date() },
      },
    });

    if (fleets.length === 0) return;

    // Attaque groupée : un seul combat par groupe, avec toutes ses flottes arrivées
    const resolvedGroups = new Set<string>();
    for (const fleet of fleets) {
      let processed = true;
      if (fleet.mission === MissionType.ATTACK && fleet.toPosition === EXPEDITION_POSITION) {
        // Position 16 : le boss galactique (aucune planète ne s'y trouve)
        processed = await this.boss.resolveAttackArrival(fleet);
      } else if (fleet.mission === MissionType.ATTACK) {
        const outcome = await this.combatService.resolveAttackMission(fleet);
        processed = outcome !== ALREADY_PROCESSED;
      } else if (fleet.mission === MissionType.ACS_ATTACK) {
        if (fleet.groupId && resolvedGroups.has(fleet.groupId)) continue;
        if (fleet.groupId) resolvedGroups.add(fleet.groupId);
        const group = fleet.groupId
          ? fleets.filter((f) => f.groupId === fleet.groupId && f.mission === MissionType.ACS_ATTACK)
          : [fleet];
        const outcome = await this.combatService.resolveGroupAttack(group);
        processed = outcome !== ALREADY_PROCESSED;
        // Chaque joueur du groupe est prévenu de l'arrivée de sa flotte
        if (processed) {
          for (const member of group) {
            this.gameEvents.emitFleetArrived(member.userId, {
              fleetId: member.id,
              mission: member.mission,
              to: `${member.toGalaxy}:${member.toSystem}:${member.toPosition}`,
            });
          }
        }
        continue;
      } else if (fleet.mission === MissionType.SPY) {
        processed = await this.spyService.resolveSpyMission(fleet);
      } else if (fleet.mission === MissionType.COLONIZE) {
        processed = await this.colonizationService.resolveColonizeMission(fleet);
      } else if (fleet.mission === MissionType.HOLD_POSITION) {
        processed = await this.resolveHold(fleet);
      } else if (fleet.mission === MissionType.EXPEDITION) {
        processed = await this.expeditionService.resolveExpedition(fleet);
      } else if (fleet.mission === MissionType.RECYCLE) {
        processed = await this.resolveRecycle(fleet);
      } else {
        processed = await this.database.$transaction(async (tx) => {
          // Prise en charge atomique (ECO-04) : un seul worker traite cette arrivee
          const claimed = await tx.fleet.updateMany({
            where: { id: fleet.id, status: 'traveling' },
            data: { status: 'returning' },
          });
          if (claimed.count !== 1) return false;

          let cargoDelivered = false;

          if (fleet.mission === MissionType.DEPLOY) {
            // Déploiement (GAME-02) : vaisseaux et cargaison passent définitivement sur la planète
            // de destination, une seule fois, sans retour. Si la destination n'est plus une planète
            // du joueur, la flotte rentre à l'origine avec son contenu intact.
            const destination = await tx.planet.findFirst({
              where: {
                galaxy: fleet.toGalaxy,
                system: fleet.toSystem,
                position: fleet.toPosition,
                isMoon: fleet.toMoon,
                userId: fleet.userId,
              },
              select: { id: true },
            });

            if (destination) {
              const cargo = fleet.cargo as Record<string, number>;
              await tx.planet.update({
                where: { id: destination.id },
                data: {
                  metal: { increment: Number(cargo.metal || 0) },
                  crystal: { increment: Number(cargo.crystal || 0) },
                  deuterium: { increment: Number(cargo.deuterium || 0) },
                },
              });

              const ships = fleet.ships as Record<string, number>;
              for (const [shipId, amount] of Object.entries(ships)) {
                await tx.ship.upsert({
                  where: { planetId_shipId: { planetId: destination.id, shipId: Number(shipId) } },
                  update: { amount: { increment: Number(amount) } },
                  create: { planetId: destination.id, shipId: Number(shipId), amount: Number(amount) },
                });
              }

              await tx.fleet.update({
                where: { id: fleet.id },
                data: { status: 'completed', ships: {}, cargo: {}, returnTime: null },
              });
            }
            return true;
          }

          if (fleet.mission === MissionType.TRANSPORT) {
            const target = await tx.planet.findFirst({
              where: {
                galaxy: fleet.toGalaxy,
                system: fleet.toSystem,
                position: fleet.toPosition,
                isMoon: fleet.toMoon,
              },
            });

            if (target) {
              const cargo = fleet.cargo as Record<string, number>;
              await tx.planet.update({
                where: { id: target.id },
                data: {
                  metal: { increment: Number(cargo.metal || 0) },
                  crystal: { increment: Number(cargo.crystal || 0) },
                  deuterium: { increment: Number(cargo.deuterium || 0) },
                },
              });
              cargoDelivered = true;
            }
          }

          if (cargoDelivered) {
            await tx.fleet.update({ where: { id: fleet.id }, data: { cargo: {} } });
          }
          return true;
        });
      }

      if (!processed) continue;

      this.gameEvents.emitFleetArrived(fleet.userId, {
        fleetId: fleet.id,
        mission: fleet.mission,
        to: `${fleet.toGalaxy}:${fleet.toSystem}:${fleet.toPosition}`,
      });
    }
  }

  /**
   * Recyclage : la flotte collecte le champ de débris des coordonnées, dans la limite de sa capacité
   * (répartie proportionnellement entre métal et cristal), puis rentre avec la récolte comme cargaison.
   * Le champ est verrouillé pour qu'aucune récolte concurrente ne compte deux fois les mêmes débris.
   */
  private async resolveRecycle(fleet: {
    id: string;
    ships: unknown;
    toGalaxy: number;
    toSystem: number;
    toPosition: number;
  }): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const claimed = await tx.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      if (claimed.count !== 1) return false;

      const rows = await tx.$queryRaw<{ id: string; metal: number; crystal: number }[]>`
        SELECT "id", "metal", "crystal" FROM "DebrisField"
        WHERE "galaxy" = ${fleet.toGalaxy} AND "system" = ${fleet.toSystem} AND "position" = ${fleet.toPosition}
        FOR UPDATE`;
      const field = rows[0];
      if (!field) return true;

      const ships = fleet.ships as Record<string, number>;
      const capacity = Object.entries(ships).reduce(
        (sum, [shipId, amount]) => sum + (SHIPS[Number(shipId)]?.cargo ?? 0) * Number(amount),
        0,
      );
      const metalAvailable = Math.max(0, Math.floor(field.metal));
      const crystalAvailable = Math.max(0, Math.floor(field.crystal));
      const total = metalAvailable + crystalAvailable;
      let metal = metalAvailable;
      let crystal = crystalAvailable;
      if (total > capacity) {
        metal = Math.floor((metalAvailable * capacity) / total);
        crystal = Math.min(crystalAvailable, capacity - metal);
      }

      if (metal > 0 || crystal > 0) {
        await tx.debrisField.update({
          where: { id: field.id },
          data: { metal: { decrement: metal }, crystal: { decrement: crystal } },
        });
        await tx.fleet.update({
          where: { id: fleet.id },
          data: { cargo: { metal, crystal, deuterium: 0 } },
        });
      }
      return true;
    });
  }

  /**
   * Arrivée d'un maintien de position : si l'hôte est toujours un allié, le dépôt d'alliance de sa planète
   * prend en charge le carburant de maintien (dans la limite de son niveau et de son deutérium, remboursé en
   * cargaison de retour), puis la flotte reste en orbite jusqu'à la fin de la durée choisie. Sinon elle rentre.
   */
  private async resolveHold(fleet: {
    id: string;
    userId: string;
    ships: unknown;
    cargo: unknown;
    holdHours: number | null;
    toGalaxy: number;
    toSystem: number;
    toPosition: number;
    toMoon: boolean;
  }): Promise<boolean> {
    const { fleetSpeed } = await this.serverConfig.getConfig();
    return this.database.$transaction(async (tx) => {
      const claimed = await tx.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      if (claimed.count !== 1) return false;

      const host = await tx.planet.findFirst({
        where: {
          galaxy: fleet.toGalaxy,
          system: fleet.toSystem,
          position: fleet.toPosition,
          isMoon: fleet.toMoon,
        },
        select: { id: true, userId: true },
      });
      const [mine, theirs] = host
        ? await Promise.all([
            tx.allianceMember.findUnique({ where: { userId: fleet.userId }, select: { allianceId: true } }),
            tx.allianceMember.findUnique({ where: { userId: host.userId }, select: { allianceId: true } }),
          ])
        : [null, null];
      const hours = fleet.holdHours ?? 0;
      if (!host || host.userId === fleet.userId || !mine || !theirs || mine.allianceId !== theirs.allianceId || hours < 1) {
        // Hôte disparu ou plus allié : la flotte rentre avec le retour déjà prévu
        return true;
      }

      // Ravitaillement : le dépôt de l'hôte rembourse le carburant de maintien déjà payé par la flotte
      let supply = 0;
      const depotPlanet = await tx.planet.findFirst({
        where: { galaxy: fleet.toGalaxy, system: fleet.toSystem, position: fleet.toPosition, isMoon: false, userId: host.userId },
        select: { id: true, allianceDepot: true },
      });
      if (depotPlanet && depotPlanet.allianceDepot > 0) {
        await lockPlanet(tx, depotPlanet.id);
        const current = await tx.planet.findUniqueOrThrow({
          where: { id: depotPlanet.id },
          select: { deuterium: true, allianceDepot: true },
        });
        const prepaid = holdFuelPerHour(
          Object.fromEntries(Object.entries(fleet.ships as Record<string, number>).map(([k, v]) => [Number(k), Number(v)])),
        ) * hours;
        supply = depotSupply({
          prepaid,
          hostDeuterium: current.deuterium,
          depotLevel: current.allianceDepot,
          hours,
        });
        if (supply > 0) {
          const debited = await tx.planet.updateMany({
            where: { id: depotPlanet.id, deuterium: { gte: supply } },
            data: { deuterium: { decrement: supply } },
          });
          if (debited.count !== 1) supply = 0;
        }
      }

      const cargo = (fleet.cargo ?? {}) as Record<string, number>;
      await tx.fleet.update({
        where: { id: fleet.id },
        data: {
          status: 'holding',
          holdUntil: new Date(Date.now() + holdSeconds(hours, fleetSpeed) * 1000),
          ...(supply > 0
            ? { cargo: { ...cargo, deuterium: Number(cargo.deuterium || 0) + supply } }
            : {}),
        },
      });
      return true;
    });
  }

  /** Fin des maintiens de position : la flotte rentre sur la durée de son trajet aller. */
  async processHolds() {
    const due = await this.database.fleet.findMany({
      where: { status: 'holding', holdUntil: { lte: new Date() } },
    });
    for (const fleet of due) {
      const flightSeconds = Math.max(
        1,
        Math.floor((fleet.arrivalTime.getTime() - fleet.startTime.getTime()) / 1000),
      );
      await this.database.fleet.updateMany({
        where: { id: fleet.id, status: 'holding' },
        data: {
          status: 'returning',
          returnTime: new Date(Date.now() + flightSeconds * 1000),
          holdUntil: null,
        },
      });
    }
  }

  private async processReturns() {
    const fleets = await this.database.fleet.findMany({
      where: {
        status: 'returning',
        returnTime: { lte: new Date() },
      },
    });

    if (fleets.length === 0) return;

    for (const fleet of fleets) {
      await this.database.$transaction(async (tx) => {
        // Prise en charge atomique (ECO-04) : un seul worker credite ce retour
        const claimed = await tx.fleet.updateMany({
          where: { id: fleet.id, status: 'returning' },
          data: { status: 'completed', cargo: {} },
        });
        if (claimed.count !== 1) return;

        const origin = await tx.planet.findFirst({
          where: {
            userId: fleet.userId,
            galaxy: fleet.fromGalaxy,
            system: fleet.fromSystem,
            position: fleet.fromPosition,
            isMoon: fleet.fromMoon,
          },
        });

        if (origin) {
          const cargo = fleet.cargo as Record<string, number>;
          if (cargo.metal || cargo.crystal || cargo.deuterium) {
            await tx.planet.update({
              where: { id: origin.id },
              data: {
                metal: { increment: Number(cargo.metal || 0) },
                crystal: { increment: Number(cargo.crystal || 0) },
                deuterium: { increment: Number(cargo.deuterium || 0) },
              },
            });
          }

          const ships = fleet.ships as Record<string, number>;
          await Promise.all(
            Object.entries(ships).map(([shipId, amount]) =>
              tx.ship.upsert({
                where: {
                  planetId_shipId: {
                    planetId: origin.id,
                    shipId: Number(shipId),
                  },
                },
                update: { amount: { increment: Number(amount) } },
                create: {
                  planetId: origin.id,
                  shipId: Number(shipId),
                  amount: Number(amount),
                },
              }),
            ),
          );
        }
      });
    }
  }
}
