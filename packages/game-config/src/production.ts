// Resource production formulas based on GAME_FORMULAS.md

/**
 * Production constants from original XNova formulas
 */
export const PRODUCTION_CONSTANTS = {
  // Base income per hour (without mines)
  METAL_BASIC_INCOME: 30,
  CRYSTAL_BASIC_INCOME: 15,
  DEUTERIUM_BASIC_INCOME: 0,

  // Solar satellite energy production
  SOLAR_SATELLITE_ENERGY: 50, // Per satellite (varies by temperature)

  // Storage base capacity
  BASE_STORAGE_SIZE: 1000000,
}

/**
 * Calculate metal mine production per hour
 * Formula: 30 * level * 1.1^level
 */
export function getMetalProduction(level: number): number {
  if (level === 0) return 0
  return Math.floor(30 * level * Math.pow(1.1, level))
}

/**
 * Calculate crystal mine production per hour
 * Formula: 20 * level * 1.1^level
 */
export function getCrystalProduction(level: number): number {
  if (level === 0) return 0
  return Math.floor(20 * level * Math.pow(1.1, level))
}

/**
 * Calculate deuterium synthesizer production per hour
 * Formula: 10 * level * 1.1^level * temperatureFactor
 * Note: Temperature not implemented in MVP, using factor 1.0
 */
export function getDeuteriumProduction(
  level: number,
  temperatureFactor: number = 1.0
): number {
  if (level === 0) return 0
  return Math.floor(10 * level * Math.pow(1.1, level) * temperatureFactor)
}

/**
 * Calculate energy consumption of metal mine
 * Formula: 10 * level * 1.1^level
 */
export function getMetalEnergyConsumption(level: number): number {
  if (level === 0) return 0
  return Math.ceil(10 * level * Math.pow(1.1, level))
}

/**
 * Calculate energy consumption of crystal mine
 * Formula: 10 * level * 1.1^level
 */
export function getCrystalEnergyConsumption(level: number): number {
  if (level === 0) return 0
  return Math.ceil(10 * level * Math.pow(1.1, level))
}

/**
 * Calculate energy consumption of deuterium synthesizer
 * Formula: 20 * level * 1.1^level
 */
export function getDeuteriumEnergyConsumption(level: number): number {
  if (level === 0) return 0
  return Math.ceil(20 * level * Math.pow(1.1, level))
}

/**
 * Calculate solar plant energy production
 * Formula: 20 * level * 1.1^level
 */
export function getSolarPlantProduction(level: number): number {
  if (level === 0) return 0
  return Math.floor(20 * level * Math.pow(1.1, level))
}

/**
 * Calculate fusion plant energy production
 * Formula: 30 * level * 1.05^level
 */
export function getFusionPlantProduction(
  level: number,
  energyTechLevel: number = 0
): number {
  if (level === 0) return 0
  const baseProduction = 30 * level * Math.pow(1.05, level)
  const techBonus = 1 + energyTechLevel * 0.01
  return Math.floor(baseProduction * techBonus)
}

/**
 * Calculate fusion plant deuterium consumption per hour
 * Formula: 10 * level * 1.1^level
 */
export function getFusionPlantConsumption(level: number): number {
  if (level === 0) return 0
  return Math.ceil(10 * level * Math.pow(1.1, level))
}

/**
 * Calculate production efficiency based on energy balance
 * Returns percentage (0-100)
 */
export function calculateProductionLevel(
  energyProduced: number,
  energyConsumed: number
): number {
  if (energyConsumed === 0) return 100
  if (energyProduced >= energyConsumed) return 100

  const level = Math.floor((energyProduced / energyConsumed) * 100)
  return Math.max(0, Math.min(100, level))
}

/**
 * Calculate storage capacity for a given storage level
 * Formula: BASE_STORAGE_SIZE * 1.5^level
 */
export function getStorageCapacity(level: number): number {
  return Math.floor(PRODUCTION_CONSTANTS.BASE_STORAGE_SIZE * Math.pow(1.5, level))
}

/**
 * Officer bonuses interface
 */
export interface OfficerBonuses {
  geologueLevel?: number // +5% production per level
  ingenieurLevel?: number // +5% energy per level
  stockeurLevel?: number // +50% storage per level
}

/**
 * Calculate total hourly production with all bonuses
 */
export interface ProductionParams {
  metalMineLevel: number
  crystalMineLevel: number
  deuteriumSynthLevel: number
  solarPlantLevel: number
  fusionPlantLevel: number
  solarSatellites: number
  energyTechLevel?: number
  officerBonuses?: OfficerBonuses
  gameSpeed?: number
}

export interface ProductionResult {
  metal: {
    production: number // Per hour
    basicIncome: number
    total: number
  }
  crystal: {
    production: number
    basicIncome: number
    total: number
  }
  deuterium: {
    production: number
    basicIncome: number
    total: number
  }
  energy: {
    produced: number
    consumed: number
    available: number
  }
  productionLevel: number // Percentage (0-100)
}

export function calculateProduction(params: ProductionParams): ProductionResult {
  const {
    metalMineLevel,
    crystalMineLevel,
    deuteriumSynthLevel,
    solarPlantLevel,
    fusionPlantLevel,
    solarSatellites,
    energyTechLevel = 0,
    officerBonuses = {},
    gameSpeed = 1,
  } = params

  const geologueBonus = 1 + (officerBonuses.geologueLevel || 0) * 0.05
  const ingenieurBonus = 1 + (officerBonuses.ingenieurLevel || 0) * 0.05

  // Energy production
  const solarEnergy = getSolarPlantProduction(solarPlantLevel)
  const fusionEnergy = getFusionPlantProduction(fusionPlantLevel, energyTechLevel)
  const satelliteEnergy = solarSatellites * PRODUCTION_CONSTANTS.SOLAR_SATELLITE_ENERGY

  const energyProduced = Math.floor(
    (solarEnergy + fusionEnergy + satelliteEnergy) * ingenieurBonus
  )

  // Energy consumption
  const metalEnergy = getMetalEnergyConsumption(metalMineLevel)
  const crystalEnergy = getCrystalEnergyConsumption(crystalMineLevel)
  const deuteriumEnergy = getDeuteriumEnergyConsumption(deuteriumSynthLevel)

  const energyConsumed = metalEnergy + crystalEnergy + deuteriumEnergy

  // Calculate production level
  const productionLevel = calculateProductionLevel(energyProduced, energyConsumed)
  const productionFactor = productionLevel / 100

  // Resource production (base)
  const metalProduction = getMetalProduction(metalMineLevel)
  const crystalProduction = getCrystalProduction(crystalMineLevel)
  const deuteriumProduction = getDeuteriumProduction(deuteriumSynthLevel)

  // Apply bonuses and production level
  const metalTotal =
    (metalProduction * geologueBonus * productionFactor +
      PRODUCTION_CONSTANTS.METAL_BASIC_INCOME) *
    gameSpeed

  const crystalTotal =
    (crystalProduction * geologueBonus * productionFactor +
      PRODUCTION_CONSTANTS.CRYSTAL_BASIC_INCOME) *
    gameSpeed

  const deuteriumTotal =
    (deuteriumProduction * geologueBonus * productionFactor +
      PRODUCTION_CONSTANTS.DEUTERIUM_BASIC_INCOME -
      getFusionPlantConsumption(fusionPlantLevel)) *
    gameSpeed

  return {
    metal: {
      production: Math.floor(metalProduction * geologueBonus * productionFactor * gameSpeed),
      basicIncome: Math.floor(PRODUCTION_CONSTANTS.METAL_BASIC_INCOME * gameSpeed),
      total: Math.floor(metalTotal),
    },
    crystal: {
      production: Math.floor(crystalProduction * geologueBonus * productionFactor * gameSpeed),
      basicIncome: Math.floor(PRODUCTION_CONSTANTS.CRYSTAL_BASIC_INCOME * gameSpeed),
      total: Math.floor(crystalTotal),
    },
    deuterium: {
      production: Math.floor(deuteriumProduction * geologueBonus * productionFactor * gameSpeed),
      basicIncome: Math.floor(PRODUCTION_CONSTANTS.DEUTERIUM_BASIC_INCOME * gameSpeed),
      total: Math.floor(deuteriumTotal),
    },
    energy: {
      produced: energyProduced,
      consumed: energyConsumed,
      available: energyProduced - energyConsumed,
    },
    productionLevel,
  }
}

/**
 * Calculate resources accumulated over a time period
 */
export function calculateResourcesOverTime(
  production: ProductionResult,
  timeInSeconds: number,
  storageCapacity: { metal: number; crystal: number; deuterium: number },
  currentResources: { metal: number; crystal: number; deuterium: number }
): { metal: number; crystal: number; deuterium: number } {
  const hoursElapsed = timeInSeconds / 3600

  const metalGained = Math.floor(production.metal.total * hoursElapsed)
  const crystalGained = Math.floor(production.crystal.total * hoursElapsed)
  const deuteriumGained = Math.floor(production.deuterium.total * hoursElapsed)

  return {
    metal: Math.min(
      currentResources.metal + metalGained,
      storageCapacity.metal
    ),
    crystal: Math.min(
      currentResources.crystal + crystalGained,
      storageCapacity.crystal
    ),
    deuterium: Math.min(
      currentResources.deuterium + deuteriumGained,
      storageCapacity.deuterium
    ),
  }
}
