import { BUILDINGS } from "./buildings";
import { TECHNOLOGIES } from "./technologies";
import { SHIPS } from "./ships";
import { DEFENSES } from "./defenses";

export const CONSTRUCTION_TECH_ID = 125;
export const PRODUCTION_TECH_ID = 126;
export const COMMANDER_MAX_LEVEL = 100;
export const COMMANDER_PARALLEL_LEVEL = 50;
export const COLONY_POWER = 1000;
export const BUILDING_FIELDS: Record<number, string> = {
  1: "metalMine",
  2: "crystalMine",
  3: "deuteriumMine",
  4: "solarPlant",
  12: "fusionPlant",
  14: "roboticsFactory",
  15: "naniteFactory",
  21: "shipyard",
  22: "metalStorage",
  23: "crystalStorage",
  24: "deuteriumStorage",
  31: "researchLab",
  33: "terraformer",
  34: "allianceDepot",
  41: "moonBase",
  42: "phalanx",
  43: "jumpGate",
  44: "missileSilo",
};

type Cost = {
  metal: number;
  crystal: number;
  deuterium: number;
  energy?: number;
};
const value = (cost: Cost) =>
  cost.metal + cost.crystal + cost.deuterium + (cost.energy ?? 0);
const cumulative = (base: Cost, factor: number, level: number) =>
  (value(base) * (Math.pow(factor, level) - 1)) / (factor - 1);
const points = (investment: number) =>
  Math.min(Number.MAX_SAFE_INTEGER, Math.floor(investment / 1000));

/** Niveau actuel : aucun XP gagné par reconstruction, aucune unité militaire ne compte. */
export function commanderThreshold(level: number) {
  return 10 * Math.pow(Math.max(0, Math.min(100, level) - 1), 3);
}
export function commanderLevel(development: number) {
  let level = 1;
  while (
    level < COMMANDER_MAX_LEVEL &&
    development >= commanderThreshold(level + 1)
  )
    level++;
  return level;
}
export function constructionCapacity(technologyLevel: number, level: number) {
  return technologyLevel < 1 ? 1 : level >= COMMANDER_PARALLEL_LEVEL ? 3 : 2;
}

export function calculateProgression(input: {
  planets: Array<{
    buildings: Record<string, number>;
    planetType: string;
    ships: Array<{ shipId: number; amount: number }>;
    defenses: Array<{ defenseId: number; amount: number }>;
  }>;
  technologies: Array<{ techId: number; level: number }>;
  fleets: Array<{ ships: Record<string, number> }>;
}) {
  let buildingInvestment = 0,
    researchInvestment = 0,
    shipInvestment = 0,
    defenseInvestment = 0;
  for (const planet of input.planets) {
    for (const [id, field] of Object.entries(BUILDING_FIELDS)) {
      const building = BUILDINGS[Number(id)];
      buildingInvestment += cumulative(
        building.baseCost,
        building.factor,
        planet.buildings[field] ?? 0,
      );
    }
    for (const row of planet.ships)
      if (SHIPS[row.shipId])
        shipInvestment += value(SHIPS[row.shipId].cost) * row.amount;
    for (const row of planet.defenses)
      if (DEFENSES[row.defenseId])
        defenseInvestment += value(DEFENSES[row.defenseId].cost) * row.amount;
  }
  for (const row of input.technologies) {
    const tech = TECHNOLOGIES[row.techId];
    if (tech)
      researchInvestment += cumulative(tech.baseCost, tech.factor, row.level);
  }
  for (const fleet of input.fleets)
    for (const [id, amount] of Object.entries(fleet.ships)) {
      if (SHIPS[Number(id)])
        shipInvestment += value(SHIPS[Number(id)].cost) * amount;
    }
  const buildings = points(buildingInvestment),
    research = points(researchInvestment);
  const development = Math.min(Number.MAX_SAFE_INTEGER, buildings + research);
  const level = commanderLevel(development);
  const colonies = Math.max(
    0,
    input.planets.filter((p) => p.planetType !== "moon").length - 1,
  );
  const breakdown = {
    buildings,
    research,
    ships: points(shipInvestment),
    defenses: points(defenseInvestment),
    colonies: colonies * COLONY_POWER,
  };
  const techLevel = (id: number) =>
    input.technologies.find((t) => t.techId === id)?.level ?? 0;
  return {
    commanderLevel: level,
    development,
    nextLevelDevelopment: level === 100 ? null : commanderThreshold(level + 1),
    levelDevelopment: commanderThreshold(level),
    power: Math.min(
      Number.MAX_SAFE_INTEGER,
      Object.values(breakdown).reduce((sum, n) => sum + n, 0),
    ),
    breakdown,
    colonies,
    buildingCapacity: constructionCapacity(
      techLevel(CONSTRUCTION_TECH_ID),
      level,
    ),
    productionCapacity: constructionCapacity(
      techLevel(PRODUCTION_TECH_ID),
      level,
    ),
    constructionTechnology: techLevel(CONSTRUCTION_TECH_ID),
    productionTechnology: techLevel(PRODUCTION_TECH_ID),
  };
}
