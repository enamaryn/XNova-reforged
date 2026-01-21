// Defense configurations based on GAME_FORMULAS.md

export interface DefenseCost {
  metal: number
  crystal: number
  deuterium: number
}

export interface DefenseStats {
  hull: number // Structure points
  shield: number
  weapon: number // Attack power
}

export interface Defense {
  id: number
  name: string
  description: string
  cost: DefenseCost
  stats: DefenseStats
  rapidfire?: Record<number, number> // Rapidfire bonuses
  requirements?: Record<string, number>
}

export const DEFENSES: Record<number, Defense> = {
  // ===== BASIC DEFENSES =====
  401: {
    id: 401,
    name: 'Lanceur de Missiles',
    description: 'Défense légère anti-chasseur',
    cost: { metal: 2000, crystal: 0, deuterium: 0 },
    stats: { hull: 200, shield: 20, weapon: 80 },
    requirements: { 21: 1 }, // Shipyard 1
  },
  402: {
    id: 402,
    name: 'Artillerie Laser Légère',
    description: 'Défense laser de base',
    cost: { metal: 1500, crystal: 500, deuterium: 0 },
    stats: { hull: 2000, shield: 25, weapon: 100 },
    requirements: { 21: 2, 113: 2, 120: 3 }, // Shipyard 2, Energy 2, Laser 3
  },
  403: {
    id: 403,
    name: 'Artillerie Laser Lourde',
    description: 'Défense laser puissante',
    cost: { metal: 6000, crystal: 2000, deuterium: 0 },
    stats: { hull: 8000, shield: 100, weapon: 250 },
    requirements: { 21: 4, 113: 3, 120: 6 }, // Shipyard 4, Energy 3, Laser 6
  },
  404: {
    id: 404,
    name: 'Canon de Gauss',
    description: 'Canon électromagnétique lourd',
    cost: { metal: 20000, crystal: 15000, deuterium: 2000 },
    stats: { hull: 35000, shield: 200, weapon: 1100 },
    requirements: { 21: 6, 113: 6, 109: 3, 111: 1 }, // Shipyard 6, Energy 6, Military 3, Shield 1
  },

  // ===== ADVANCED DEFENSES =====
  405: {
    id: 405,
    name: 'Artillerie à Ions',
    description: 'Défense ionique avancée',
    cost: { metal: 2000, crystal: 6000, deuterium: 0 },
    stats: { hull: 8000, shield: 500, weapon: 150 },
    requirements: { 21: 4, 121: 4 }, // Shipyard 4, Ion 4
  },
  406: {
    id: 406,
    name: 'Canon à Plasma',
    description: 'Défense plasma ultra-puissante',
    cost: { metal: 50000, crystal: 50000, deuterium: 30000 },
    stats: { hull: 100000, shield: 300, weapon: 3000 },
    requirements: { 21: 8, 122: 7 }, // Shipyard 8, Plasma 7
  },
  407: {
    id: 407,
    name: 'Petit Bouclier',
    description: 'Bouclier planétaire de base',
    cost: { metal: 10000, crystal: 10000, deuterium: 0 },
    stats: { hull: 20000, shield: 2000, weapon: 1 },
    requirements: { 21: 6, 111: 2 }, // Shipyard 6, Shield 2
  },
  408: {
    id: 408,
    name: 'Grand Bouclier',
    description: 'Bouclier planétaire avancé',
    cost: { metal: 50000, crystal: 50000, deuterium: 0 },
    stats: { hull: 100000, shield: 10000, weapon: 1 },
    requirements: { 21: 8, 111: 6 }, // Shipyard 8, Shield 6
  },

  // ===== MISSILES =====
  502: {
    id: 502,
    name: 'Missile Interplanétaire',
    description: 'Missile d\'attaque à longue portée',
    cost: { metal: 12500, crystal: 2500, deuterium: 10000 },
    stats: { hull: 15000, shield: 0, weapon: 12000 },
    requirements: { 44: 1, 117: 1 }, // Silo 1, Impulse 1
  },
  503: {
    id: 503,
    name: 'Missile Interception',
    description: 'Missile anti-missile',
    cost: { metal: 8000, crystal: 0, deuterium: 2000 },
    stats: { hull: 8000, shield: 0, weapon: 1 },
    requirements: { 44: 1, 117: 1 }, // Silo 1, Impulse 1
  },
}

// Helper to get defense stats with technology bonuses
export function getDefenseStats(
  defenseId: number,
  armorLevel: number,
  shieldLevel: number,
  weaponLevel: number
): DefenseStats {
  const defense = DEFENSES[defenseId]
  if (!defense) {
    return { hull: 0, shield: 0, weapon: 0 }
  }

  return {
    hull: Math.floor(defense.stats.hull * (1 + armorLevel * 0.1)),
    shield: Math.floor(defense.stats.shield * (1 + shieldLevel * 0.1)),
    weapon: Math.floor(defense.stats.weapon * (1 + weaponLevel * 0.1)),
  }
}

// Helper to check if defense requirements are met
export function checkDefenseRequirements(
  defenseId: number,
  planetBuildings: Record<string, number>,
  userTechnologies: Record<string, number> = {}
): { canBuild: boolean; missingRequirements: string[] } {
  const defense = DEFENSES[defenseId]
  if (!defense) {
    return { canBuild: false, missingRequirements: ['Defense not found'] }
  }

  const missingRequirements: string[] = []

  if (defense.requirements) {
    for (const [reqId, reqLevel] of Object.entries(defense.requirements)) {
      const reqIdNum = parseInt(reqId)

      // Check if it's a building requirement (ID < 100) or tech requirement (ID >= 100)
      const currentLevel = reqIdNum < 100
        ? (planetBuildings[reqIdNum] || 0)
        : (userTechnologies[reqIdNum] || 0)

      if (currentLevel < reqLevel) {
        const reqName = reqIdNum < 100
          ? `Bâtiment ${reqIdNum}`
          : `Technologie ${reqIdNum}`
        missingRequirements.push(`${reqName} niveau ${reqLevel} requis (actuel: ${currentLevel})`)
      }
    }
  }

  return {
    canBuild: missingRequirements.length === 0,
    missingRequirements,
  }
}
