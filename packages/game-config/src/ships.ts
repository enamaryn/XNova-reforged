// Ship configurations based on GAME_FORMULAS.md

export interface ShipCost {
  metal: number
  crystal: number
  deuterium: number
}

export interface ShipStats {
  hull: number // Structure points
  shield: number
  weapon: number // Attack power
}

export interface Ship {
  id: number
  name: string
  description: string
  cost: ShipCost
  stats: ShipStats
  speed: number // Base speed
  cargo: number // Cargo capacity
  consumption: number // Fuel consumption per 10 units distance
  rapidfire?: Record<number, number> // Rapidfire against other ships/defenses
  requirements?: Record<string, number>
}

export const SHIPS: Record<number, Ship> = {
  // ===== CARGO SHIPS =====
  202: {
    id: 202,
    name: 'Petit Transporteur',
    description: 'Transport de ressources courtes distances',
    cost: { metal: 2000, crystal: 2000, deuterium: 0 },
    stats: { hull: 4000, shield: 10, weapon: 5 },
    speed: 5000,
    cargo: 6000,
    consumption: 10,
    requirements: { 21: 2, 115: 2 }, // Shipyard 2, Combustion 2
  },
  203: {
    id: 203,
    name: 'Grand Transporteur',
    description: 'Transport de ressources longues distances',
    cost: { metal: 6000, crystal: 6000, deuterium: 0 },
    stats: { hull: 12000, shield: 25, weapon: 5 },
    speed: 7500,
    cargo: 25000,
    consumption: 50,
    requirements: { 21: 4, 115: 6 },
  },

  // ===== COMBAT SHIPS =====
  204: {
    id: 204,
    name: 'Chasseur Léger',
    description: 'Petit vaisseau rapide et peu coûteux',
    cost: { metal: 2500, crystal: 800, deuterium: 0 },
    stats: { hull: 4000, shield: 10, weapon: 60 },
    speed: 12500,
    cargo: 50,
    consumption: 20,
    rapidfire: { 210: 5, 401: 10 }, // vs Sonde, Lanceur
    requirements: { 21: 1, 115: 1 },
  },
  205: {
    id: 205,
    name: 'Chasseur Lourd',
    description: 'Chasseur puissant polyvalent',
    cost: { metal: 6000, crystal: 4000, deuterium: 0 },
    stats: { hull: 10000, shield: 25, weapon: 150 },
    speed: 10000,
    cargo: 100,
    consumption: 75,
    rapidfire: { 204: 3, 210: 5, 401: 10 },
    requirements: { 21: 3, 113: 2, 117: 2 },
  },
  206: {
    id: 206,
    name: 'Croiseur',
    description: 'Vaisseau de ligne rapide',
    cost: { metal: 18000, crystal: 6000, deuterium: 2000 },
    stats: { hull: 27000, shield: 50, weapon: 400 },
    speed: 15000,
    cargo: 800,
    consumption: 300,
    rapidfire: { 204: 6, 210: 5, 401: 10, 402: 10 },
    requirements: { 21: 5, 117: 4, 114: 2 },
  },
  207: {
    id: 207,
    name: 'Vaisseau de Bataille',
    description: 'Navire de guerre lourdement armé',
    cost: { metal: 45000, crystal: 15000, deuterium: 0 },
    stats: { hull: 60000, shield: 200, weapon: 1000 },
    speed: 10000,
    cargo: 1500,
    consumption: 500,
    requirements: { 21: 7, 118: 4 },
  },

  // ===== SPECIAL SHIPS =====
  208: {
    id: 208,
    name: 'Vaisseau de Colonisation',
    description: 'Permet de coloniser de nouvelles planètes',
    cost: { metal: 10000, crystal: 20000, deuterium: 10000 },
    stats: { hull: 30000, shield: 100, weapon: 50 },
    speed: 2500,
    cargo: 7500,
    consumption: 1000,
    requirements: { 21: 4, 117: 3 },
  },
  209: {
    id: 209,
    name: 'Recycleur',
    description: 'Récupère les débris spatiaux',
    cost: { metal: 10000, crystal: 6000, deuterium: 2000 },
    stats: { hull: 16000, shield: 10, weapon: 1 },
    speed: 2000,
    cargo: 20000,
    consumption: 300,
    requirements: { 21: 4, 115: 6, 111: 2 },
  },
  210: {
    id: 210,
    name: 'Sonde d\'Espionnage',
    description: 'Espionne les planètes ennemies',
    cost: { metal: 0, crystal: 1000, deuterium: 0 },
    stats: { hull: 1000, shield: 0, weapon: 0 },
    speed: 100000000, // Ultra-fast
    cargo: 0,
    consumption: 1,
    requirements: { 21: 3, 115: 3, 106: 2 },
  },
  211: {
    id: 211,
    name: 'Bombardier',
    description: 'Efficace contre les défenses planétaires',
    cost: { metal: 50000, crystal: 25000, deuterium: 15000 },
    stats: { hull: 75000, shield: 500, weapon: 1000 },
    speed: 4000,
    cargo: 500,
    consumption: 1000,
    rapidfire: { 401: 20, 402: 20, 403: 10 }, // vs all defenses
    requirements: { 21: 8, 117: 6, 122: 5 },
  },
  212: {
    id: 212,
    name: 'Satellite Solaire',
    description: 'Fournit de l\'énergie gratuitement',
    cost: { metal: 0, crystal: 2000, deuterium: 500 },
    stats: { hull: 2000, shield: 1, weapon: 1 },
    speed: 0, // Stationary
    cargo: 0,
    consumption: 0,
    requirements: { 21: 1 },
  },
  213: {
    id: 213,
    name: 'Destructeur',
    description: 'Vaisseau de combat lourd',
    cost: { metal: 60000, crystal: 50000, deuterium: 15000 },
    stats: { hull: 110000, shield: 500, weapon: 2000 },
    speed: 5000,
    cargo: 2000,
    consumption: 1000,
    requirements: { 21: 9, 118: 6, 114: 5 },
  },
  214: {
    id: 214,
    name: 'Étoile de la Mort',
    description: 'Super-arme capable de détruire des lunes',
    cost: { metal: 5000000, crystal: 4000000, deuterium: 1000000 },
    stats: { hull: 9000000, shield: 50000, weapon: 200000 },
    speed: 100,
    cargo: 1000000,
    consumption: 1,
    rapidfire: { /* Everything */ },
    requirements: { 21: 12, 118: 7, 114: 6, 199: 1 },
  },
  215: {
    id: 215,
    name: 'Traqueur',
    description: 'Vaisseau de combat rapide',
    cost: { metal: 30000, crystal: 40000, deuterium: 15000 },
    stats: { hull: 70000, shield: 400, weapon: 700 },
    speed: 10000,
    cargo: 10000,
    consumption: 250,
    rapidfire: { 206: 3 }, // vs Cruiser
    requirements: { 21: 7, 114: 5, 118: 5 },
  },
}

// Helper to get ship speed with technology bonuses
export function getShipSpeed(
  shipId: number,
  combustionLevel: number,
  impulseLevel: number,
  hyperspaceLevel: number
): number {
  const ship = SHIPS[shipId]
  if (!ship) return 0

  // Determine which drive the ship uses
  const driveType = getShipDriveType(shipId)

  let speed = ship.speed

  switch (driveType) {
    case 'combustion':
      speed *= 1 + combustionLevel * 0.1
      break
    case 'impulse':
      speed *= 1 + impulseLevel * 0.2
      break
    case 'hyperspace':
      speed *= 1 + hyperspaceLevel * 0.3
      break
  }

  return Math.floor(speed)
}

// Determine ship drive type
function getShipDriveType(shipId: number): 'combustion' | 'impulse' | 'hyperspace' {
  // Small ships use combustion
  if ([202, 204, 210].includes(shipId)) return 'combustion'
  // Medium ships use impulse
  if ([203, 205, 208, 209, 211].includes(shipId)) return 'impulse'
  // Large ships use hyperspace
  if ([206, 207, 213, 214, 215].includes(shipId)) return 'hyperspace'

  return 'combustion'
}
