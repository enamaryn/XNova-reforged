// Expéditions : constantes, tirage de l'issue et calculs communs à l'API et à l'interface.

/** Technologie Expédition : nécessaire pour envoyer une expédition. */
export const EXPEDITION_TECH_ID = 124;
/** Les expéditions visent l'espace profond : la position 16 de n'importe quel système. */
export const EXPEDITION_POSITION = 16;

/** Nombre d'expéditions simultanées : racine entière du niveau de la technologie. */
export function maxExpeditions(techLevel: number): number {
  return Math.floor(Math.sqrt(Math.max(0, Math.floor(techLevel || 0))));
}

export type ExpeditionOutcome =
  | 'nothing'
  | 'resources'
  | 'ships'
  | 'delay'
  | 'speedup'
  | 'pirates'
  | 'blackhole';

/** Poids (en pour mille) de chaque issue ; le total fait 1000. */
export const EXPEDITION_OUTCOME_WEIGHTS: readonly { outcome: ExpeditionOutcome; weight: number }[] = [
  { outcome: 'nothing', weight: 300 },
  { outcome: 'resources', weight: 300 },
  { outcome: 'ships', weight: 90 },
  { outcome: 'delay', weight: 100 },
  { outcome: 'speedup', weight: 50 },
  { outcome: 'pirates', weight: 150 },
  { outcome: 'blackhole', weight: 10 },
];

/** Issue correspondant à un tirage uniforme dans [0, 1[. */
export function pickExpeditionOutcome(roll: number): ExpeditionOutcome {
  const total = EXPEDITION_OUTCOME_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const entry of EXPEDITION_OUTCOME_WEIGHTS) {
    if (threshold < entry.weight) return entry.outcome;
    threshold -= entry.weight;
  }
  return 'nothing';
}

export type ExpeditionResource = 'metal' | 'crystal' | 'deuterium';

/**
 * Ressources trouvées : une part (10 % à 30 %, plus 2 % par niveau d'Expédition) de la capacité de la flotte,
 * jamais plus que la place libre. Le type vient d'un second tirage (métal 50 %, cristal 33 %, deutérium 17 %).
 */
export function expeditionResourceFind(params: {
  capacity: number;
  usedCargo: number;
  techLevel: number;
  amountRoll: number;
  typeRoll: number;
}): { resource: ExpeditionResource; amount: number } {
  const free = Math.max(0, Math.floor(params.capacity) - Math.floor(params.usedCargo));
  const share = 0.1 + 0.2 * Math.min(Math.max(params.amountRoll, 0), 1) + 0.02 * Math.max(0, params.techLevel);
  const resource: ExpeditionResource =
    params.typeRoll < 0.5 ? 'metal' : params.typeRoll < 0.83 ? 'crystal' : 'deuterium';
  const raw = Math.floor(Math.max(0, params.capacity) * share * (resource === 'deuterium' ? 0.5 : 1));
  return { resource, amount: Math.min(free, raw) };
}

/** Vaisseaux pouvant être trouvés : petits transporteurs, chasseurs légers et sondes. */
export const EXPEDITION_FOUND_SHIPS: readonly number[] = [202, 204, 210];

/** Vaisseaux trouvés : jusqu'à 10 % de la flotte (au moins 1, au plus 10), d'un type tiré au sort. */
export function expeditionShipFind(params: {
  fleetSize: number;
  amountRoll: number;
  typeRoll: number;
}): { shipId: number; amount: number } {
  const index = Math.min(
    EXPEDITION_FOUND_SHIPS.length - 1,
    Math.floor(Math.min(Math.max(params.typeRoll, 0), 0.999999) * EXPEDITION_FOUND_SHIPS.length),
  );
  const cap = Math.min(10, Math.max(1, Math.ceil(Math.max(0, params.fleetSize) * 0.1)));
  const amount = Math.max(1, Math.ceil(Math.min(Math.max(params.amountRoll, 0), 1) * cap));
  return { shipId: EXPEDITION_FOUND_SHIPS[index], amount };
}

/** Facteur appliqué à la durée du retour : retard +50 % à +200 %, avance −20 % à −50 %. */
export function expeditionDelayFactor(roll: number): number {
  return 1.5 + 1.5 * Math.min(Math.max(roll, 0), 1);
}
export function expeditionSpeedupFactor(roll: number): number {
  return 0.8 - 0.3 * Math.min(Math.max(roll, 0), 1);
}

/** Pirates : 10 % à 30 % de chaque type de vaisseau est perdu. */
export function expeditionPirateLossFraction(roll: number): number {
  return 0.1 + 0.2 * Math.min(Math.max(roll, 0), 1);
}
