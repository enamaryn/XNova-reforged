// Building configurations based on GAME_FORMULAS.md

import { TECHNOLOGIES } from './technologies'

export interface BuildingCost {
  metal: number
  crystal: number
  deuterium: number
  energy?: number
}

export interface Building {
  id: number
  name: string
  description: string
  baseCost: BuildingCost
  factor: number // Exponential cost multiplier
  category: 'resource' | 'facility' | 'station' | 'defense' | 'moon'
  requirements?: Record<string, number> // Building/Tech requirements
}

/**
 * Configuration statique des batiments (base XNova legacy + ajustements).
 *
 * Modifications majeures:
 * - Facteur 2.0 -> 1.8 pour batiments strategiques.
 * - Consommation energie reequilibree.
 * - Multiplicateurs configurables cote serveur.
 *
 * @see docs/GAME_BALANCE.md
 */
export const BUILDINGS: Record<number, Building> = {
  // ===== RESOURCE PRODUCTION =====
  1: {
    id: 1,
    name: 'Mine de Métal',
    description: 'Produit du métal, ressource de base pour la construction',
    baseCost: { metal: 60, crystal: 15, deuterium: 0 },
    factor: 1.5,
    category: 'resource',
  },
  2: {
    id: 2,
    name: 'Mine de Cristal',
    description: 'Produit du cristal, ressource pour les technologies avancées',
    baseCost: { metal: 48, crystal: 24, deuterium: 0 },
    factor: 1.6,
    category: 'resource',
  },
  3: {
    id: 3,
    name: 'Synthétiseur de Deutérium',
    description: 'Produit du deutérium, carburant pour les flottes',
    baseCost: { metal: 225, crystal: 75, deuterium: 0 },
    factor: 1.5,
    category: 'resource',
  },
  4: {
    id: 4,
    name: 'Centrale Électrique Solaire',
    description: 'Fournit de l\'énergie pour les mines',
    baseCost: { metal: 75, crystal: 30, deuterium: 0 },
    factor: 1.5,
    category: 'resource',
  },
  12: {
    id: 12,
    name: 'Centrale Électrique de Fusion',
    description: 'Produit beaucoup d\'énergie en consommant du deutérium',
    baseCost: { metal: 900, crystal: 360, deuterium: 180 },
    factor: 1.8,
    category: 'resource',
    requirements: { 3: 5, 113: 3 }, // Deut Synth 5, Energy Tech 3
  },

  // ===== FACILITIES =====
  14: {
    id: 14,
    name: 'Usine de Robots',
    description: 'Accélère la construction de bâtiments',
    baseCost: { metal: 350, crystal: 120, deuterium: 200 },
    factor: 1.8,
    category: 'facility',
  },
  15: {
    id: 15,
    name: 'Usine de Nanites',
    description: 'Accélère grandement la construction',
    baseCost: { metal: 900000, crystal: 450000, deuterium: 90000 },
    factor: 1.75,
    category: 'facility',
    requirements: { 14: 10, 108: 10 }, // Robotics 10, Computer 10
  },
  21: {
    id: 21,
    name: 'Hangar',
    description: 'Permet de construire des vaisseaux',
    baseCost: { metal: 400, crystal: 200, deuterium: 100 },
    factor: 2.0,
    category: 'facility',
  },

  // ===== STORAGE =====
  22: {
    id: 22,
    name: 'Hangar de Métal',
    description: 'Augmente la capacité de stockage de métal',
    baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
    factor: 2.0,
    category: 'facility',
  },
  23: {
    id: 23,
    name: 'Hangar de Cristal',
    description: 'Augmente la capacité de stockage de cristal',
    baseCost: { metal: 1000, crystal: 500, deuterium: 0 },
    factor: 2.0,
    category: 'facility',
  },
  24: {
    id: 24,
    name: 'Réservoir de Deutérium',
    description: 'Augmente la capacité de stockage de deutérium',
    baseCost: { metal: 1000, crystal: 1000, deuterium: 0 },
    factor: 2.0,
    category: 'facility',
  },

  // ===== STATION =====
  31: {
    id: 31,
    name: 'Laboratoire de Recherche',
    description: 'Permet de rechercher des technologies',
    baseCost: { metal: 200, crystal: 400, deuterium: 200 },
    factor: 1.8,
    category: 'station',
  },
  33: {
    id: 33,
    name: 'Terraformeur',
    description: 'Augmente le nombre de cases disponibles',
    baseCost: { metal: 0, crystal: 50000, deuterium: 100000 },
    factor: 2.0,
    category: 'station',
    requirements: { 113: 12 }, // Energy Tech 12
  },
  34: {
    id: 34,
    name: 'Dépôt d\'Alliance',
    description: 'Permet de ravitailler les flottes alliées',
    baseCost: { metal: 20000, crystal: 40000, deuterium: 0 },
    factor: 2.0,
    category: 'station',
  },
  44: {
    id: 44,
    name: 'Silo de Missiles',
    description: 'Permet de construire des missiles de défense',
    baseCost: { metal: 20000, crystal: 20000, deuterium: 1000 },
    factor: 2.0,
    category: 'defense',
    requirements: { 21: 1 }, // Shipyard 1
  },

  // ===== MOON ONLY =====
  41: {
    id: 41,
    name: 'Base Lunaire',
    description: 'Donne des cases constructibles sur la lune',
    baseCost: { metal: 20000, crystal: 40000, deuterium: 20000 },
    factor: 2.0,
    category: 'moon',
  },
  42: {
    id: 42,
    name: 'Phalange de Capteur',
    description: 'Détecte les mouvements de flottes ennemies',
    baseCost: { metal: 20000, crystal: 40000, deuterium: 20000 },
    factor: 2.0,
    category: 'moon',
    requirements: { 41: 1 }, // Moon Base 1
  },
  43: {
    id: 43,
    name: 'Porte de Saut Spatial',
    description: 'Permet de téléporter des flottes instantanément',
    baseCost: { metal: 2000000, crystal: 4000000, deuterium: 2000000 },
    factor: 2.0,
    category: 'moon',
    requirements: { 41: 1, 114: 7 }, // Moon Base 1, Hyperspace 7
  },
}

/**
 * Calcule le cout d'un batiment au niveau donne.
 *
 * Formule:
 * cout = baseCost * (factor ^ currentLevel)
 *
 * @param buildingId - ID du batiment.
 * @param currentLevel - Niveau actuel.
 * @returns Cout par ressource pour le prochain niveau.
 */
export function getBuildingCost(buildingId: number, currentLevel: number): BuildingCost {
  const building = BUILDINGS[buildingId]
  if (!building) {
    throw new Error(`Building ${buildingId} not found`)
  }

  const multiplier = Math.pow(building.factor, currentLevel)

  return {
    metal: Math.floor(building.baseCost.metal * multiplier),
    crystal: Math.floor(building.baseCost.crystal * multiplier),
    deuterium: Math.floor(building.baseCost.deuterium * multiplier),
    energy: building.baseCost.energy
      ? Math.floor(building.baseCost.energy * multiplier)
      : 0,
  }
}

// Helper to calculate demolition refund (25% of cost)
export function getDemolitionRefund(buildingId: number, currentLevel: number): BuildingCost {
  const cost = getBuildingCost(buildingId, currentLevel - 1)

  return {
    metal: Math.floor(cost.metal / 4),
    crystal: Math.floor(cost.crystal / 4),
    deuterium: Math.floor(cost.deuterium / 4),
  }
}

// Helper to calculate construction time
// Formula from GAME_FORMULAS.md:
// buildTime = (metal + crystal) / (2500 * (1 + roboticsLevel) * 2^naniteLevel)
export interface BuildTimeParams {
  buildingId: number
  currentLevel: number
  roboticsLevel: number
  naniteLevel?: number
  engineerLevel?: number // Officer bonus (-5% per level)
}

export function getBuildingTime(params: BuildTimeParams): number {
  const {
    buildingId,
    currentLevel,
    roboticsLevel,
    naniteLevel = 0,
    engineerLevel = 0,
  } = params

  const cost = getBuildingCost(buildingId, currentLevel)

  // Base time calculation (in seconds)
  const baseDivisor = 2500 * (1 + roboticsLevel) * Math.pow(2, naniteLevel)
  let buildTime = (cost.metal + cost.crystal) / baseDivisor

  // Apply engineer bonus (-5% per level)
  if (engineerLevel > 0) {
    buildTime *= (1 - engineerLevel * 0.05)
  }

  // Ensure minimum 1 second
  return Math.max(1, Math.floor(buildTime))
}

// Helper to check if requirements are met
export function checkBuildingRequirements(
  buildingId: number,
  planetBuildings: Record<string, number>,
  userTechnologies: Record<string, number> = {}
): { canBuild: boolean; missingRequirements: string[] } {
  const building = BUILDINGS[buildingId]
  if (!building) {
    return { canBuild: false, missingRequirements: ['Building not found'] }
  }

  const missingRequirements: string[] = []

  if (building.requirements) {
    for (const [reqId, reqLevel] of Object.entries(building.requirements)) {
      const reqIdNum = parseInt(reqId)

      // Check if it's a building requirement (ID < 100) or tech requirement (ID >= 100)
      const currentLevel = reqIdNum < 100
        ? (planetBuildings[reqIdNum] || 0)
        : (userTechnologies[reqIdNum] || 0)

      if (currentLevel < reqLevel) {
      const reqName = reqIdNum < 100
          ? (BUILDINGS[reqIdNum]?.name || `Batiment ${reqIdNum}`)
          : (TECHNOLOGIES[reqIdNum]?.name || `Technologie ${reqIdNum}`)
        missingRequirements.push(`${reqName} niveau ${reqLevel} requis (actuel: ${currentLevel})`)
      }
    }
  }

  return {
    canBuild: missingRequirements.length === 0,
    missingRequirements,
  }
}
