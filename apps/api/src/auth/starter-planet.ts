import { GAME_CONSTANTS } from '@xnova/game-config';
import { Prisma } from '@prisma/client';

/** Planète de départ d'un compte créé hors inscription web (commandes terminal). */
export function randomStarterCoordinates() {
  return {
    galaxy: Math.floor(Math.random() * GAME_CONSTANTS.MAX_GALAXIES) + 1,
    system: Math.floor(Math.random() * GAME_CONSTANTS.MAX_SYSTEMS) + 1,
    position: Math.floor(Math.random() * GAME_CONSTANTS.MAX_POSITIONS) + 1,
  };
}

/** Crée la planète de départ ; reprend avec d'autres coordonnées si la position est déjà prise (P2002). */
export async function createStarterPlanetWithRetry(
  db: Pick<Prisma.TransactionClient, 'planet'>,
  userId: string,
  fieldsMax: number,
  attempts = 10,
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await db.planet.create({
        data: {
          userId,
          name: 'Planète Mère',
          ...randomStarterCoordinates(),
          planetType: 'normal',
          metal: GAME_CONSTANTS.STARTING_METAL,
          crystal: GAME_CONSTANTS.STARTING_CRYSTAL,
          deuterium: GAME_CONSTANTS.STARTING_DEUTERIUM,
          fieldsMax,
          fieldsUsed: 0,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002' || attempt === attempts) throw error;
    }
  }
  throw new Error('Aucune position libre trouvée pour la planète de départ');
}
