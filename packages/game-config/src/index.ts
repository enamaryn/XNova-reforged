// Export all game configurations
export * from "./buildings";
export * from "./technologies";
export * from "./ships";
export * from "./defenses";
export * from "./production";
export * from "./multipliers";
export * from "./progression";
export * from "./onboarding";
export * from "./speed-profiles";

// Compte technique propriétaire des planètes abandonnées, exclu du classement des joueurs.
export const ABANDONED_USERNAME = "__abandoned__";

// Game constants
export const GAME_CONSTANTS = {
  // Universe
  MAX_GALAXIES: 9,
  MAX_SYSTEMS: 499,
  MAX_POSITIONS: 15,

  // Planets
  MAX_PLAYER_PLANETS: 21,
  BASE_STORAGE_SIZE: 1000000,
  MAX_OVERFLOW: 1.1,
  INITIAL_FIELDS: 163,

  // Resources
  STARTING_METAL: 500,
  STARTING_CRYSTAL: 500,
  STARTING_DEUTERIUM: 0,

  // Construction
  MAX_BUILDING_QUEUE: 5,

  // Combat
  MAX_COMBAT_ROUNDS: 6,
  DEBRIS_FACTOR: 0.3, // 30% goes to debris
  DEFENSE_REPAIR_FACTOR: 0.7, // 70% defenses repaired

  // Time (seconds)
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
};

// Mission types
export enum MissionType {
  ATTACK = 1,
  ACS_ATTACK = 2,
  TRANSPORT = 3,
  DEPLOY = 4,
  HOLD_POSITION = 5,
  SPY = 6,
  COLONIZE = 7,
  RECYCLE = 8,
  DESTROY = 9,
  EXPEDITION = 15,
}

// Missions réellement traitées à l'arrivée (liste commune API/UI, GAME-01).
// Les autres missions (expédition...) restent refusées par l'API sans débit.
export const IMPLEMENTED_MISSIONS: readonly MissionType[] = [
  MissionType.ATTACK,
  MissionType.TRANSPORT,
  MissionType.DEPLOY,
  MissionType.SPY,
  MissionType.COLONIZE,
  MissionType.RECYCLE,
];

/** Identifiants des vaisseaux imposés par certaines missions. */
export const ESPIONAGE_PROBE_ID = 210;
export const COLONY_SHIP_ID = 208;
export const RECYCLER_ID = 209;
/** Satellite solaire : reste en orbite de la planète où il est construit (aucun envoi), fournit de l'énergie. */
export const SOLAR_SATELLITE_ID = 212;
/** Technologie Espionnage : détermine le niveau d'information d'un rapport d'espionnage. */
export const ESPIONAGE_TECH_ID = 106;

// Fleet status
export enum FleetStatus {
  TRAVELING = "traveling",
  ARRIVED = "arrived",
  RETURNING = "returning",
  COMPLETED = "completed",
}

// Combat result
export enum CombatResult {
  ATTACKER_WIN = "attacker_win",
  DEFENDER_WIN = "defender_win",
  DRAW = "draw",
}

/**
 * Défenses constructibles (SCOPE-01). Les missiles (502, 503) dépendent du silo et des attaques
 * interplanétaires, hors périmètre : ils ne sont ni proposés ni acceptés.
 */
export const IMPLEMENTED_DEFENSES: readonly number[] = [
  401, 402, 403, 404, 405, 406, 407, 408,
];

/** Boucliers planétaires : une seule unité par planète. */
export const SINGLE_UNIT_DEFENSES: readonly number[] = [407, 408];

/**
 * Bâtiments réellement fonctionnels : les autres (dépôt d'alliance, silo de missiles, bâtiments lunaires) dépendent
 * de fonctions absentes (maintien de position, missiles, lunes) et ne sont ni proposés ni acceptés.
 */
export const IMPLEMENTED_BUILDINGS: readonly number[] = [
  1, 2, 3, 4, 12, 14, 15, 21, 22, 23, 24, 31, 33,
];

/**
 * Technologies réellement fonctionnelles : le réseau de recherche intergalactique (123) et l'expédition (124)
 * dépendent de fonctions absentes et ne sont ni proposés ni acceptés.
 */
export const IMPLEMENTED_TECHNOLOGIES: readonly number[] = [
  106, 108, 109, 110, 111, 113, 114, 115, 117, 118, 120, 121, 122, 125, 126, 199,
];

/** Cases ajoutées par niveau de terraformeur (le terraformeur lui-même n'occupe pas de case). */
export const TERRAFORMER_FIELDS_PER_LEVEL = 5;
export const TERRAFORMER_ID = 33;

/** Technologie Ordinateur : une flotte en vol de base, plus une par niveau. */
export const COMPUTER_TECH_ID = 108;
export const BASE_FLEET_SLOTS = 1;
export function maxFleetSlots(computerTechnologyLevel: number): number {
  return BASE_FLEET_SLOTS + Math.max(0, Math.floor(computerTechnologyLevel || 0));
}

export * from "./production-queue";
export * from "./item-texts";
