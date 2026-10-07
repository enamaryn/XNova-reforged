import {
  BUILDINGS,
  TECHNOLOGIES,
  SHIPS,
  DEFENSES,
  IMPLEMENTED_DEFENSES,
} from "@xnova/game-config";
import {
  calculateMineProduction,
  updateResources,
  type ResourceConfig,
  type ResourceLevels,
} from "@xnova/game-engine";

type UpgradePlanet = ResourceLevels & {
  roboticsFactory: number;
  naniteFactory: number;
  shipyard: number;
  researchLab: number;
  fieldsUsed: number;
  fieldsMax: number;
};

export interface BuildingUpgradeEffect {
  key: string;
  label: string;
  unit: "perHour" | "energy" | "capacity" | "percent" | "fields";
  current: number;
  next: number;
  delta: number;
  beneficial: boolean;
  compact: boolean;
}

const resourceFields: Record<number, keyof ResourceLevels> = {
  1: "metalMine",
  2: "crystalMine",
  3: "deuteriumMine",
  4: "solarPlant",
  12: "fusionPlant",
  22: "metalStorage",
  23: "crystalStorage",
  24: "deuteriumStorage",
};
const resourceNames = {
  metal: "Métal",
  crystal: "Cristal",
  deuterium: "Deutérium",
};

/** Prévision sans écriture, avec le même moteur et les mêmes réglages que la production réelle. */
export function getBuildingUpgradeEffects(
  buildingId: number,
  currentLevel: number,
  planet: UpgradePlanet,
  config: ResourceConfig,
  buildingLevels: Record<string, number>,
  techLevels: Record<string, number>,
) {
  const nextLevel = currentLevel + 1;
  const nextPlanet = { ...planet };
  const field = resourceFields[buildingId];
  if (field) nextPlanet[field] = nextLevel;
  const snapshot = (levels: ResourceLevels) =>
    updateResources({
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      levels,
      lastUpdate: new Date(0),
      now: new Date(0),
      config,
    });
  const current = snapshot(planet);
  const next = snapshot(nextPlanet);
  const effects: BuildingUpgradeEffect[] = [];
  const add = (
    key: string,
    label: string,
    unit: BuildingUpgradeEffect["unit"],
    before: number,
    after: number,
    compact = false,
    lowerIsBetter = false,
  ) => {
    const delta = after - before;
    effects.push({
      key,
      label,
      unit,
      current: before,
      next: after,
      delta,
      beneficial: lowerIsBetter ? delta < 0 : delta > 0,
      compact,
    });
  };

  const mineResource = ({ 1: "metal", 2: "crystal", 3: "deuterium" } as const)[
    buildingId as 1 | 2 | 3
  ];
  if (mineResource) {
    const multiplier = config.resourceMultiplier * config.gameSpeed;
    add(
      "potential",
      `${resourceNames[mineResource]} à pleine puissance`,
      "perHour",
      calculateMineProduction(planet)[mineResource] * multiplier,
      calculateMineProduction(nextPlanet)[mineResource] * multiplier,
      true,
    );
  }
  if ([1, 2, 3, 4, 12].includes(buildingId)) {
    add(
      "energy",
      "Solde d’énergie de la planète",
      "energy",
      current.energy.available - current.energy.used,
      next.energy.available - next.energy.used,
      true,
    );
    add(
      "efficiency",
      "Rendement des mines",
      "percent",
      current.energy.productionLevel,
      next.energy.productionLevel,
    );
    for (const resource of ["metal", "crystal", "deuterium"] as const) {
      add(
        `production-${resource}`,
        `${resourceNames[resource]} réellement produit sur la planète`,
        "perHour",
        current.productionPerHour[resource],
        next.productionPerHour[resource],
      );
    }
  }
  const storageResource = (
    { 22: "metal", 23: "crystal", 24: "deuterium" } as const
  )[buildingId as 22 | 23 | 24];
  if (storageResource) {
    add(
      "storage",
      `Stockage de ${resourceNames[storageResource].toLowerCase()}`,
      "capacity",
      current.storage[storageResource],
      next.storage[storageResource],
      true,
    );
  }
  // Variation du facteur de durée, à coût identique, avant arrondi/minimum d’une seconde.
  if ([14, 15].includes(buildingId)) {
    add(
      "building-duration",
      "Durée des futures constructions",
      "percent",
      100,
      buildingId === 15 ? 50 : (100 * (currentLevel + 1)) / (nextLevel + 1),
      true,
      true,
    );
  }
  if ([15, 21].includes(buildingId)) {
    add(
      "ship-duration",
      "Durée des futurs vaisseaux et défenses",
      "percent",
      100,
      buildingId === 15 ? 50 : (100 * (currentLevel + 1)) / (nextLevel + 1),
      true,
      true,
    );
  }
  if (buildingId === 31) {
    add(
      "research-duration",
      "Durée des futures recherches",
      "percent",
      100,
      (100 * (currentLevel + 1)) / (nextLevel + 1),
      true,
      true,
    );
  }
  if (!storageResource) {
    add(
      "fields",
      "Cases libres sur la planète",
      "fields",
      planet.fieldsMax - planet.fieldsUsed,
      planet.fieldsMax - planet.fieldsUsed - 1,
    );
  }
  const levelsAfter = { ...buildingLevels, [buildingId]: nextLevel };
  const candidates = [
    ...Object.values(BUILDINGS),
    ...Object.values(TECHNOLOGIES),
    ...Object.values(SHIPS),
    ...IMPLEMENTED_DEFENSES.map((id) => DEFENSES[id]),
  ];
  const meets = (
    requirements: Record<string, number>,
    levels: Record<string, number>,
  ) =>
    Object.entries(requirements).every(
      ([id, level]) =>
        (Number(id) < 100 ? levels[id] || 0 : techLevels[id] || 0) >= level,
    );
  const unlocks = candidates
    .filter(
      (item) =>
        item.requirements?.[buildingId] === nextLevel &&
        meets(item.requirements, levelsAfter) &&
        !meets(item.requirements, buildingLevels),
    )
    .map((item) => item.name);
  return {
    nextLevel,
    effects,
    unlocks,
    energyLimited: next.energy.productionLevel < 100,
  };
}
