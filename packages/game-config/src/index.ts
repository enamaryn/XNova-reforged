// Export all game configurations
export * from './buildings'
export * from './technologies'
export * from './ships'
export * from './defenses'
export * from './production'
export * from './multipliers'

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
}

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
// Les autres missions (recyclage, expédition...) restent refusées par l'API sans débit.
export const IMPLEMENTED_MISSIONS: readonly MissionType[] = [
  MissionType.ATTACK,
  MissionType.TRANSPORT,
  MissionType.DEPLOY,
  MissionType.SPY,
  MissionType.COLONIZE,
]

/** Identifiants des vaisseaux imposés par certaines missions. */
export const ESPIONAGE_PROBE_ID = 210
export const COLONY_SHIP_ID = 208
/** Technologie Espionnage : détermine le niveau d'information d'un rapport d'espionnage. */
export const ESPIONAGE_TECH_ID = 106

// Fleet status
export enum FleetStatus {
  TRAVELING = 'traveling',
  ARRIVED = 'arrived',
  RETURNING = 'returning',
  COMPLETED = 'completed',
}

// Combat result
export enum CombatResult {
  ATTACKER_WIN = 'attacker_win',
  DEFENDER_WIN = 'defender_win',
  DRAW = 'draw',
}

/**
 * Défenses constructibles (SCOPE-01). Les missiles (502, 503) dépendent du silo et des attaques
 * interplanétaires, hors périmètre : ils ne sont ni proposés ni acceptés.
 */
export const IMPLEMENTED_DEFENSES: readonly number[] = [401, 402, 403, 404, 405, 406, 407, 408]

/** Boucliers planétaires : une seule unité par planète. */
export const SINGLE_UNIT_DEFENSES: readonly number[] = [407, 408]
