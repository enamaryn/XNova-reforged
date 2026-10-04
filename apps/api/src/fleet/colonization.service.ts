import { Injectable } from '@nestjs/common';
import { COLONY_SHIP_ID, GAME_CONSTANTS } from '@xnova/game-config';
import { lockUser } from '../common/atomic';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ServerConfigService } from '../server-config/server-config.service';

/**
 * Mission de colonisation : à l'arrivée, si la position est libre et que le joueur n'a pas atteint
 * son maximum de planètes, la planète est créée et un vaisseau de colonisation est consommé ; le
 * reste de la flotte rentre. Sinon toute la flotte rentre intacte.
 */
@Injectable()
export class ColonizationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  /** @returns true si cette exécution a pris la flotte en charge (sinon un autre worker l'a traitée). */
  async resolveColonizeMission(fleet: {
    id: string;
    userId: string;
    ships: unknown;
    colonyName?: string | null;
    toGalaxy: number;
    toSystem: number;
    toPosition: number;
  }): Promise<boolean> {
    const config = await this.serverConfig.getConfig();

    const outcome = await this.database.$transaction(async (tx) => {
      // Prise en charge atomique (ECO-04)
      const claimed = await tx.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      if (claimed.count !== 1) return undefined;

      // Quota par joueur : serialise les colonisations simultanees du meme joueur
      await lockUser(tx, fleet.userId);

      const ships = { ...(fleet.ships as Record<string, number>) };
      const colonizers = Number(ships[COLONY_SHIP_ID] ?? 0);
      if (colonizers < 1) return { founded: null };

      const owned = await tx.planet.count({ where: { userId: fleet.userId } });
      if (owned >= GAME_CONSTANTS.MAX_PLAYER_PLANETS) return { founded: null };

      // createMany + skipDuplicates : une position prise entre-temps ne fait pas echouer la transaction
      const created = await tx.planet.createMany({
        data: [
          {
            userId: fleet.userId,
            name: fleet.colonyName?.trim() || 'Colonie',
            galaxy: fleet.toGalaxy,
            system: fleet.toSystem,
            position: fleet.toPosition,
            planetType: 'normal',
            metal: GAME_CONSTANTS.STARTING_METAL,
            crystal: GAME_CONSTANTS.STARTING_CRYSTAL,
            deuterium: GAME_CONSTANTS.STARTING_DEUTERIUM,
            fieldsMax: config.planetSize,
            fieldsUsed: 0,
          },
        ],
        skipDuplicates: true,
      });
      if (created.count !== 1) return { founded: null };

      // Un vaisseau de colonisation est consomme ; le reste rentre (rien ne rentre s'il n'en reste pas)
      if (colonizers === 1) {
        delete ships[COLONY_SHIP_ID];
      } else {
        ships[COLONY_SHIP_ID] = colonizers - 1;
      }
      const remaining = Object.values(ships).some((n) => Number(n) > 0);
      await tx.fleet.update({
        where: { id: fleet.id },
        data: remaining
          ? { ships }
          : { status: 'completed', ships: {}, cargo: {}, returnTime: null },
      });

      const planet = await tx.planet.findUniqueOrThrow({
        where: {
          galaxy_system_position: {
            galaxy: fleet.toGalaxy,
            system: fleet.toSystem,
            position: fleet.toPosition,
          },
        },
        select: { id: true },
      });
      return { founded: planet.id };
    });

    if (outcome === undefined) return false;

    if (outcome.founded) {
      this.gameEvents.emitToUser(fleet.userId, 'colony:founded', { planetId: outcome.founded });
    }
    return true;
  }
}
