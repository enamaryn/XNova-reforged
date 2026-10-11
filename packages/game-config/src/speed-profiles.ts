// Profils de vitesse du serveur : jeux de réglages vérifiés (coûts et formules inchangés).
// Les clés sont celles de la configuration serveur (`ServerConfigValues`, page d'administration).

export interface SpeedProfileSettings {
  gameSpeed: number
  fleetSpeed: number
  resourceMultiplier: number
  buildingCostMultiplier: number
  researchCostMultiplier: number
  shipCostMultiplier: number
  baseMetal: number
  baseCrystal: number
  baseDeuterium: number
}

const BASE = {
  resourceMultiplier: 1,
  buildingCostMultiplier: 1,
  researchCostMultiplier: 1,
  shipCostMultiplier: 1,
  baseMetal: 20,
  baseCrystal: 10,
  baseDeuterium: 0,
} as const

/**
 * - `classic` : rythme d'origine (×1), très lent (laboratoire après ~18 h, premier chasseur après plusieurs jours).
 * - `minimum` : ×20, plancher accepté pour un premier cycle jouable (laboratoire ≈ 55 min, estimation).
 * - `reference` : ×50, profil mesuré par `first-cycle-progression.integration.spec.ts`
 *   (laboratoire ≈ 22 min, première recherche ≈ 57 min, premier vaisseau ≈ 112 min) et utilisé pour la validation de charge.
 */
export const SPEED_PROFILES = {
  classic: { ...BASE, gameSpeed: 1, fleetSpeed: 1 },
  minimum: { ...BASE, gameSpeed: 20, fleetSpeed: 20 },
  reference: { ...BASE, gameSpeed: 50, fleetSpeed: 50 },
} as const satisfies Record<string, SpeedProfileSettings>

export type SpeedProfileName = keyof typeof SPEED_PROFILES

/** Profil retenu par le propriétaire le 10 octobre 2026. */
export const RECOMMENDED_SPEED_PROFILE: SpeedProfileName = 'reference'
