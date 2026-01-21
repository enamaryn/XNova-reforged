import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MissionType } from '@xnova/game-config';
import { CombatService } from '../combat/combat.service';
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
      if (fleet.mission === MissionType.ATTACK) {
        await this.combatService.resolveAttackMission(fleet);
      } else {
        await this.database.$transaction(async (tx) => {
          let cargoDelivered = false;
          if (fleet.mission === MissionType.TRANSPORT || fleet.mission === MissionType.DEPLOY) {
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

          await tx.fleet.update({
            where: { id: fleet.id },
            data: cargoDelivered ? { status: 'returning', cargo: {} } : { status: 'returning' },
          });
        });
      }

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

        await tx.fleet.update({
          where: { id: fleet.id },
          data: { status: 'completed', cargo: {} },
        });
      });
    }
  }
}
