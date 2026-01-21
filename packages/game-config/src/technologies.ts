// Technology configurations based on GAME_FORMULAS.md

export interface TechCost {
  metal: number
  crystal: number
  deuterium: number
  energy?: number // For special techs like Graviton
}

export interface Technology {
  id: number
  name: string
  description: string
  baseCost: TechCost
  factor: number
  category: 'basic' | 'drive' | 'advanced' | 'combat'
  requirements?: Record<string, number>
}

export const TECHNOLOGIES: Record<number, Technology> = {
  // ===== BASIC TECHNOLOGIES =====
  106: {
    id: 106,
    name: 'Technologie Espionnage',
    description: 'Permet d\'espionner les planètes ennemies',
    baseCost: { metal: 220, crystal: 1100, deuterium: 220 },
    factor: 1.8,
    category: 'basic',
    requirements: { 31: 3 }, // Research Lab 3
  },
  108: {
    id: 108,
    name: 'Technologie Ordinateur',
    description: 'Augmente le nombre de flottes simultanées',
    baseCost: { metal: 0, crystal: 400, deuterium: 600 },
    factor: 1.8,
    category: 'basic',
    requirements: { 31: 1 },
  },
  113: {
    id: 113,
    name: 'Technologie Énergie',
    description: 'Requis pour certains bâtiments et technologies',
    baseCost: { metal: 0, crystal: 800, deuterium: 400 },
    factor: 1.8,
    category: 'basic',
    requirements: { 31: 1 },
  },
  114: {
    id: 114,
    name: 'Technologie Hyperespace',
    description: 'Permet le voyage intergalactique',
    baseCost: { metal: 0, crystal: 4000, deuterium: 2000 },
    factor: 1.8,
    category: 'advanced',
    requirements: { 31: 7, 113: 5, 111: 5 },
  },
  124: {
    id: 124,
    name: 'Technologie Expédition',
    description: 'Permet d\'envoyer des expéditions spatiales',
    baseCost: { metal: 4000, crystal: 8000, deuterium: 4000 },
    factor: 1.8,
    category: 'advanced',
    requirements: { 31: 3, 114: 1, 118: 5 },
  },

  // ===== DRIVE TECHNOLOGIES =====
  115: {
    id: 115,
    name: 'Réacteur à Combustion',
    description: 'Augmente la vitesse des vaisseaux à réacteur combustion',
    baseCost: { metal: 460, crystal: 0, deuterium: 690 },
    factor: 1.8,
    category: 'drive',
    requirements: { 31: 1, 113: 1 },
  },
  117: {
    id: 117,
    name: 'Réacteur à Impulsion',
    description: 'Augmente la vitesse des vaisseaux à impulsion',
    baseCost: { metal: 2000, crystal: 4000, deuterium: 600 },
    factor: 1.8,
    category: 'drive',
    requirements: { 31: 2, 113: 1 },
  },
  118: {
    id: 118,
    name: 'Propulsion Hyperespace',
    description: 'Augmente la vitesse des vaisseaux hyperespace',
    baseCost: { metal: 10000, crystal: 20000, deuterium: 6000 },
    factor: 1.8,
    category: 'drive',
    requirements: { 31: 7, 114: 3 },
  },

  // ===== COMBAT TECHNOLOGIES =====
  109: {
    id: 109,
    name: 'Technologie Militaire',
    description: 'Requis pour vaisseaux de combat avancés',
    baseCost: { metal: 800, crystal: 200, deuterium: 0 },
    factor: 1.8,
    category: 'combat',
    requirements: { 31: 4 },
  },
  110: {
    id: 110,
    name: 'Technologie Défense',
    description: 'Augmente la résistance des défenses',
    baseCost: { metal: 200, crystal: 600, deuterium: 0 },
    factor: 1.8,
    category: 'combat',
    requirements: { 31: 2 },
  },
  111: {
    id: 111,
    name: 'Technologie Bouclier',
    description: 'Augmente la puissance des boucliers',
    baseCost: { metal: 200, crystal: 600, deuterium: 0 },
    factor: 1.8,
    category: 'combat',
    requirements: { 31: 6, 113: 3 },
  },
  120: {
    id: 120,
    name: 'Technologie Laser',
    description: 'Augmente la puissance des armes laser',
    baseCost: { metal: 200, crystal: 100, deuterium: 0 },
    factor: 1.8,
    category: 'combat',
    requirements: { 31: 1, 113: 2 },
  },
  121: {
    id: 121,
    name: 'Technologie Ions',
    description: 'Augmente la puissance des armes à ions',
    baseCost: { metal: 1000, crystal: 300, deuterium: 100 },
    factor: 1.8,
    category: 'combat',
    requirements: { 31: 4, 120: 5, 113: 4 },
  },
  122: {
    id: 122,
    name: 'Technologie Plasma',
    description: 'Augmente la puissance des armes à plasma',
    baseCost: { metal: 2000, crystal: 4000, deuterium: 1000 },
    factor: 1.8,
    category: 'combat',
    requirements: { 31: 4, 113: 8, 120: 10, 121: 5 },
  },
  123: {
    id: 123,
    name: 'Réseau de Recherche Intergalactique',
    description: 'Permet de lier plusieurs laboratoires',
    baseCost: { metal: 240000, crystal: 400000, deuterium: 160000 },
    factor: 1.8,
    category: 'advanced',
    requirements: { 31: 10, 108: 8, 114: 8 },
  },
  199: {
    id: 199,
    name: 'Technologie Graviton',
    description: 'Requis pour l\'Étoile de la Mort',
    baseCost: { metal: 0, crystal: 0, deuterium: 0, energy: 300000 },
    factor: 3.0,
    category: 'advanced',
    requirements: { 31: 12 },
  },
}

// Helper to calculate technology cost at specific level
export function getTechnologyCost(techId: number, currentLevel: number): TechCost {
  const tech = TECHNOLOGIES[techId]
  if (!tech) {
    throw new Error(`Technology ${techId} not found`)
  }

  const multiplier = Math.pow(tech.factor, currentLevel)

  return {
    metal: Math.floor(tech.baseCost.metal * multiplier),
    crystal: Math.floor(tech.baseCost.crystal * multiplier),
    deuterium: Math.floor(tech.baseCost.deuterium * multiplier),
    energy: tech.baseCost.energy
      ? Math.floor(tech.baseCost.energy * multiplier)
      : undefined,
  }
}
