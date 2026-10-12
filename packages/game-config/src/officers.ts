// Officiers : personnages passifs embauchés une fois, bonus permanents sur tout le compte du joueur.

export const OFFICER_TYPES = ['intendant', 'admiral', 'engineer', 'geologist', 'technocrat'] as const;
export type OfficerType = (typeof OFFICER_TYPES)[number];

/** Coût d'embauche en deutérium, prélevé sur la planète choisie. */
export const OFFICER_COST_DEUTERIUM = 500_000;

export interface OfficerEffects {
  /** Fractions (0,1 = +10 %). */
  energy: number;
  mineProduction: number;
  storage: number;
  /** Fractions de réduction (0,1 = −10 % de durée). */
  buildTimeReduction: number;
  researchTimeReduction: number;
  /** Vitesse des flottes (fraction). */
  fleetSpeed: number;
  extraExpeditions: number;
  extraBuildSlots: number;
  espionageLevels: number;
}

export const NO_OFFICER_BONUS: OfficerEffects = {
  energy: 0,
  mineProduction: 0,
  storage: 0,
  buildTimeReduction: 0,
  researchTimeReduction: 0,
  fleetSpeed: 0,
  extraExpeditions: 0,
  extraBuildSlots: 0,
  espionageLevels: 0,
};

/** Bonus fournis par chaque officier (ajoutés entre eux). */
export const OFFICERS: Record<OfficerType, { bonus: Partial<OfficerEffects> }> = {
  intendant: { bonus: { energy: 0.1, extraBuildSlots: 1 } },
  admiral: { bonus: { fleetSpeed: 0.1, extraExpeditions: 2 } },
  engineer: { bonus: { buildTimeReduction: 0.1 } },
  geologist: { bonus: { mineProduction: 0.1, storage: 0.1 } },
  technocrat: { bonus: { researchTimeReduction: 0.1, espionageLevels: 2 } },
};

export function isOfficerType(value: unknown): value is OfficerType {
  return typeof value === 'string' && (OFFICER_TYPES as readonly string[]).includes(value);
}

/** Somme des bonus des officiers embauchés (types inconnus ignorés, doublons comptés une fois). */
export function officerBonuses(hired: readonly string[]): OfficerEffects {
  const total = { ...NO_OFFICER_BONUS };
  for (const type of new Set(hired)) {
    if (!isOfficerType(type)) continue;
    for (const [key, value] of Object.entries(OFFICERS[type].bonus)) {
      total[key as keyof OfficerEffects] += value as number;
    }
  }
  return total;
}

/** Durée après réduction (au moins 1 s). */
export function reducedSeconds(seconds: number, reduction: number): number {
  // En millièmes entiers : évite 100 × (1 − 0,9) = 9,999… arrondi à 9
  const permille = Math.round(Math.min(0.9, Math.max(0, reduction)) * 1000);
  return Math.max(1, Math.floor((seconds * (1000 - permille)) / 1000));
}
