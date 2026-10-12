// Commandants de flotte : personnages recrutés, assignés à une flotte à l'envoi, qui gagnent de l'expérience au combat.
// Distincts du « niveau de commandant » du joueur (progression) et des officiers passifs.

export const FLEET_COMMANDER_SKILLS = ['attack', 'defense', 'speed', 'cargo'] as const;
export type FleetCommanderSkill = (typeof FLEET_COMMANDER_SKILLS)[number];

/** Nombre maximal de commandants par joueur. */
export const MAX_FLEET_COMMANDERS = 3;
/** Prix de recrutement en deutérium, prélevé sur la planète choisie. */
export const FLEET_COMMANDER_COST_DEUTERIUM = 250_000;
export const FLEET_COMMANDER_MAX_LEVEL = 20;
export const FLEET_COMMANDER_MAX_SKILL = 10;
/** Chaque niveau de compétence ajoute 1 % (de 1 à 10 %). */
export const SKILL_BONUS_PER_LEVEL = 0.01;
/** Probabilité de mourir quand toute la flotte est détruite. */
export const COMMANDER_DEATH_CHANCE = 0.1;
export const COMMANDER_NAME_MAX_LENGTH = 24;

/** Expérience nécessaire pour passer du niveau `level` au suivant : 1000 × 1,5^(niveau − 1). */
export function experienceToLevel(level: number): number {
  return Math.floor(1000 * Math.pow(1.5, Math.max(1, Math.floor(level)) - 1));
}

/** Expérience totale requise pour atteindre un niveau (le niveau 1 vaut 0). */
export function experienceForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, FLEET_COMMANDER_MAX_LEVEL); l += 1) total += experienceToLevel(l);
  return total;
}

/** Niveau (1 à 20) correspondant à une expérience totale. */
export function levelFromExperience(experience: number): number {
  let level = 1;
  while (level < FLEET_COMMANDER_MAX_LEVEL && experience >= experienceForLevel(level + 1)) level += 1;
  return level;
}

/** Un point de compétence par niveau gagné. */
export function skillPointsForLevel(level: number): number {
  return Math.max(0, Math.min(level, FLEET_COMMANDER_MAX_LEVEL) - 1);
}

/** Expérience d'un combat : 100 + 1 par 1 000 de métal et cristal détruits chez l'adversaire (plafonné). */
export function combatExperience(enemyLossValue: number): number {
  const value = Math.max(0, Math.floor(Number.isFinite(enemyLossValue) ? enemyLossValue : 0));
  return 100 + Math.min(20_000, Math.floor(value / 1000));
}

export interface CommanderSkills {
  attack: number;
  defense: number;
  speed: number;
  cargo: number;
}

export interface CommanderBonuses {
  /** Fractions (0,05 = +5 %). */
  attack: number;
  defense: number;
  speed: number;
  cargo: number;
}

export const NO_COMMANDER_BONUS: CommanderBonuses = { attack: 0, defense: 0, speed: 0, cargo: 0 };

/** Bonus d'un commandant selon ses niveaux de compétence (bornés à 0–10). */
export function commanderBonuses(skills?: Partial<CommanderSkills> | null): CommanderBonuses {
  const level = (value: number | undefined) =>
    Math.max(0, Math.min(FLEET_COMMANDER_MAX_SKILL, Math.floor(Number(value) || 0)));
  return {
    attack: level(skills?.attack) * SKILL_BONUS_PER_LEVEL,
    defense: level(skills?.defense) * SKILL_BONUS_PER_LEVEL,
    speed: level(skills?.speed) * SKILL_BONUS_PER_LEVEL,
    cargo: level(skills?.cargo) * SKILL_BONUS_PER_LEVEL,
  };
}

export function isCommanderSkill(value: unknown): value is FleetCommanderSkill {
  return typeof value === 'string' && (FLEET_COMMANDER_SKILLS as readonly string[]).includes(value);
}
