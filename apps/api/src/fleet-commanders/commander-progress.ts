import { Prisma } from '@prisma/client';
import {
  COMMANDER_DEATH_CHANCE,
  FLEET_COMMANDER_MAX_LEVEL,
  combatExperience,
  commanderBonuses,
  experienceForLevel,
  levelFromExperience,
  skillPointsForLevel,
  type CommanderBonuses,
} from '@xnova/game-config';

type Db = Pick<Prisma.TransactionClient, 'fleetCommander'>;

/** Bonus du commandant assigné à une flotte (aucun s'il n'y en a pas ou s'il a disparu). */
export async function commanderBonusesFor(db: Db, commanderId: string | null | undefined): Promise<CommanderBonuses> {
  if (!commanderId) return commanderBonuses(null);
  const commander = await db.fleetCommander.findUnique({
    where: { id: commanderId },
    select: { attack: true, defense: true, speed: true, cargo: true },
  });
  return commanderBonuses(commander);
}

/**
 * Applique le résultat d'un combat au commandant : expérience (niveaux et points de compétence gagnés),
 * ou mort avec la probabilité COMMANDER_DEATH_CHANCE quand toute la flotte est détruite (`died` fourni par l'appelant).
 */
export async function applyCombatToCommander(
  db: Db,
  commanderId: string,
  outcome: { enemyLossValue: number; fleetDestroyed: boolean; died: boolean },
) {
  const commander = await db.fleetCommander.findUnique({ where: { id: commanderId } });
  if (!commander) return null;
  if (outcome.fleetDestroyed && outcome.died) {
    await db.fleetCommander.delete({ where: { id: commanderId } });
    return { died: true as const };
  }
  const cap = experienceForLevel(FLEET_COMMANDER_MAX_LEVEL);
  const experience = Math.min(cap, commander.experience + combatExperience(outcome.enemyLossValue));
  const level = levelFromExperience(experience);
  const gained = Math.max(0, skillPointsForLevel(level) - skillPointsForLevel(commander.level));
  await db.fleetCommander.update({
    where: { id: commanderId },
    data: { experience, level, skillPoints: { increment: gained } },
  });
  return { died: false as const, experience, level, gainedPoints: gained };
}

export { COMMANDER_DEATH_CHANCE };
