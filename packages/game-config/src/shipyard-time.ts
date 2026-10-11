// Durée de fabrication au chantier spatial (vaisseaux et défenses), partagée par l'API et les tests.

/** Profil de référence du plancher : vitesse du serveur pour laquelle le plancher est exprimé. */
export const SHIPYARD_FLOOR_REFERENCE_SPEED = 50;
/**
 * Plancher de durée à la vitesse de référence : (métal + cristal) / 660 secondes par unité, soit 5 s pour un
 * chasseur léger (3 300) et environ 3 h 47 pour une Étoile de la Mort (9 000 000), quel que soit le niveau du
 * hangar ou des nanites. Il empêche les unités les plus chères de devenir instantanées en fin de partie.
 */
export const SHIPYARD_FLOOR_DIVISOR = 660;

export interface ShipyardTimeInput {
  /** Coût de l'unité (après multiplicateur de coût du serveur). */
  cost: { metal: number; crystal: number };
  shipyardLevel: number;
  naniteLevel?: number;
  /** Vitesse du jeu du serveur (`gameSpeed`). */
  gameSpeed: number;
}

/**
 * Durée d'UNE unité, en secondes, sans arrondi.
 * - Base : formule d'origine `(métal + cristal) / (2 500 × (1 + hangar) × 2^nanites)` en **heures**, soit ×3600 s,
 *   divisée par la vitesse du serveur.
 * - Plancher : `(métal + cristal) / 660` s à la vitesse de référence ×50, ramené à la vitesse du serveur.
 * La durée retenue est la plus grande des deux.
 */
export function calculateShipyardUnitSeconds({
  cost,
  shipyardLevel,
  naniteLevel = 0,
  gameSpeed,
}: ShipyardTimeInput): number {
  const speed = gameSpeed > 0 ? gameSpeed : 1;
  const total = Math.max(0, cost.metal + cost.crystal);
  const base = ((total / (2500 * (1 + Math.max(0, shipyardLevel)) * Math.pow(2, Math.max(0, naniteLevel)))) * 3600) / speed;
  const floor = (total / SHIPYARD_FLOOR_DIVISOR) * (SHIPYARD_FLOOR_REFERENCE_SPEED / speed);
  return Math.max(base, floor);
}

/** Durée d'un lot, en secondes entières (au moins 1 s) : c'est la durée réellement programmée dans la file. */
export function calculateShipyardBatchSeconds(input: ShipyardTimeInput, amount: number): number {
  return Math.max(1, Math.floor(calculateShipyardUnitSeconds(input) * Math.max(1, Math.floor(amount))));
}
