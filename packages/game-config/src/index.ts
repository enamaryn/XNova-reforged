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
