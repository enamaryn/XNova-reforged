// Game speed multipliers and server configuration

/**
 * Server speed multipliers
 * These control the pace of the game globally
 */
export interface GameMultipliers {
  // Production speed (affects resource generation)
  gameSpeed: number

  // Fleet speed (affects travel time)
  fleetSpeed: number

  // Research speed (affects tech research time)
  researchSpeed: number

  // Build speed (affects construction time)
  buildSpeed: number

  // Resource multiplier (affects all production)
  resourceMultiplier: number
}

/**
 * Debris field configuration
 */
export interface DebrisConfig {
  // Percentage of destroyed ships that becomes debris (0.0 - 1.0)
  fleetToDebris: number

  // Percentage of destroyed defenses that becomes debris (0.0 - 1.0)
  defenseToDebris: number

  // Whether debris fields expire over time
  debrisDecay: boolean

  // Hours before debris starts decaying (if enabled)
  debrisDecayAfterHours: number
}

/**
 * Combat configuration
 */
export interface CombatConfig {
  // Maximum combat rounds
  maxRounds: number

  // Percentage of defenses that are repaired after battle (0.0 - 1.0)
  defenseRepairFactor: number

  // Rapidfire enabled
  rapidfireEnabled: boolean

  // Shield regeneration per round (0.0 - 1.0, typically 0.7 = 70%)
  shieldRegeneration: number
}

/**
 * Economy configuration
 */
export interface EconomyConfig {
  // Basic resource income per hour (without mines)
  metalBasicIncome: number
  crystalBasicIncome: number
  deuteriumBasicIncome: number

  // Starting resources for new players
  startingMetal: number
  startingCrystal: number
  startingDeuterium: number

  // Initial planet fields
  initialFields: number

  // Storage overflow allowed (1.1 = 110%)
  maxOverflow: number
}

/**
 * Universe configuration
 */
export interface UniverseConfig {
  // Universe size
  maxGalaxies: number
  maxSystems: number
  maxPositions: number

  // Colonization
  maxPlayerPlanets: number
  colonizationEnabled: boolean

  // Expedition
  expeditionEnabled: boolean
  maxExpeditions: number

  // Alliance
  allianceMaxMembers: number
}

/**
 * Default configuration for a balanced x2.5 speed server
 * Recommended for MVP
 */
export const DEFAULT_MULTIPLIERS: GameMultipliers = {
  gameSpeed: 2.5, // 2.5x production
  fleetSpeed: 2.5, // 2.5x faster travel
  researchSpeed: 2.5, // 2.5x faster research
  buildSpeed: 2.5, // 2.5x faster construction
  resourceMultiplier: 1.0, // No additional multiplier
}

/**
 * Default debris configuration
 * Standard OGame-like settings
 */
export const DEFAULT_DEBRIS: DebrisConfig = {
  fleetToDebris: 0.3, // 30% of destroyed fleet value
  defenseToDebris: 0.0, // 0% of destroyed defenses (can be 0.3 for more resources)
  debrisDecay: false, // Disabled for MVP
  debrisDecayAfterHours: 168, // 7 days (if enabled)
}

/**
 * Default combat configuration
 */
export const DEFAULT_COMBAT: CombatConfig = {
  maxRounds: 6,
  defenseRepairFactor: 0.7, // 70% repaired
  rapidfireEnabled: true,
  shieldRegeneration: 0.7, // 70% per round
}

/**
 * Default economy configuration
 */
export const DEFAULT_ECONOMY: EconomyConfig = {
  metalBasicIncome: 30, // +50% from legacy (was 20)
  crystalBasicIncome: 15, // +50% from legacy (was 10)
  deuteriumBasicIncome: 0,
  startingMetal: 500,
  startingCrystal: 500,
  startingDeuterium: 0,
  initialFields: 163,
  maxOverflow: 1.1, // 110%
}

/**
 * Default universe configuration
 */
export const DEFAULT_UNIVERSE: UniverseConfig = {
  maxGalaxies: 9,
  maxSystems: 499,
  maxPositions: 15,
  maxPlayerPlanets: 21,
  colonizationEnabled: true,
  expeditionEnabled: true,
  maxExpeditions: 5,
  allianceMaxMembers: 100,
}

/**
 * Preset configurations for different server types
 */
export const SERVER_PRESETS = {
  // Slow server - more strategic gameplay
  slow: {
    multipliers: {
      gameSpeed: 1.0,
      fleetSpeed: 1.0,
      researchSpeed: 1.0,
      buildSpeed: 1.0,
      resourceMultiplier: 1.0,
    },
  },

  // Standard server - balanced (RECOMMENDED FOR MVP)
  standard: {
    multipliers: DEFAULT_MULTIPLIERS,
  },

  // Fast server - quick progression
  fast: {
    multipliers: {
      gameSpeed: 5.0,
      fleetSpeed: 5.0,
      researchSpeed: 5.0,
      buildSpeed: 5.0,
      resourceMultiplier: 1.0,
    },
  },

  // Ultra fast server - testing/fun
  ultra: {
    multipliers: {
      gameSpeed: 10.0,
      fleetSpeed: 10.0,
      researchSpeed: 10.0,
      buildSpeed: 10.0,
      resourceMultiplier: 2.0,
    },
  },
}

/**
 * Apply multipliers to a base value
 */
export function applyMultiplier(baseValue: number, multiplier: number): number {
  return Math.floor(baseValue * multiplier)
}

/**
 * Calculate effective build time with speed multipliers
 */
export function calculateEffectiveBuildTime(
  baseBuildTime: number,
  buildSpeedMultiplier: number
): number {
  return Math.max(1, Math.floor(baseBuildTime / buildSpeedMultiplier))
}

/**
 * Calculate effective research time with speed multipliers
 */
export function calculateEffectiveResearchTime(
  baseResearchTime: number,
  researchSpeedMultiplier: number
): number {
  return Math.max(1, Math.floor(baseResearchTime / researchSpeedMultiplier))
}

/**
 * Calculate effective fleet travel time with speed multipliers
 */
export function calculateEffectiveFleetTime(
  baseFleetTime: number,
  fleetSpeedMultiplier: number
): number {
  return Math.max(1, Math.floor(baseFleetTime / fleetSpeedMultiplier))
}

/**
 * Get server configuration from environment variables
 * Falls back to defaults if not specified
 */
export function getServerConfig(): {
  multipliers: GameMultipliers
  debris: DebrisConfig
  combat: CombatConfig
  economy: EconomyConfig
  universe: UniverseConfig
} {
  // In a real implementation, these would come from process.env
  // For now, return defaults
  return {
    multipliers: DEFAULT_MULTIPLIERS,
    debris: DEFAULT_DEBRIS,
    combat: DEFAULT_COMBAT,
    economy: DEFAULT_ECONOMY,
    universe: DEFAULT_UNIVERSE,
  }
}
