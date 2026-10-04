import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MissionType } from '@xnova/game-config';
import { ALREADY_PROCESSED, CombatService } from '../combat/combat.service';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';

@Injectable()
export class FleetCronService {
  private readonly logger = new Logger(FleetCronService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly gameEvents: GameEventsGateway,
    private readonly combatService: CombatService,
  ) {}

  /**
   * Vérifie toutes les 10 secondes les flottes arrivées et de retour
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleFleetStatus() {
    try {
      await this.processArrivals();
      await this.processReturns();
    } catch (error) {
      this.logger.error('Error in fleet cron job:', error);
    }
  }

  private async processArrivals() {
    const fleets = await this.database.fleet.findMany({
      where: {
        status: 'traveling',
        arrivalTime: { lte: new Date() },
      },
    });

    if (fleets.length === 0) return;

    for (const fleet of fleets) {
      let processed = true;
      if (fleet.mission === MissionType.ATTACK) {
        const outcome = await this.combatService.resolveAttackMission(fleet);
        processed = outcome !== ALREADY_PROCESSED;
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
