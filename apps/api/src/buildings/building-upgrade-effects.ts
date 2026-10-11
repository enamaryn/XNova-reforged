import {
  BUILDINGS,
  TECHNOLOGIES,
  SHIPS,
  DEFENSES,
  IMPLEMENTED_BUILDINGS,
  IMPLEMENTED_DEFENSES,
  IMPLEMENTED_TECHNOLOGIES,
  TERRAFORMER_FIELDS_PER_LEVEL,
  TERRAFORMER_ID,
} from "@xnova/game-config";
import {
  calculateMineProduction,
  updateResources,
  type ResourceConfig,
  type ResourceLevels,
} from "@xnova/game-engine";
import { currentLocale, itemName } from '../common/request-locale';

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
type ResourceKey = "metal" | "crystal" | "deuterium";
type EffectTexts = {
  resources: Record<ResourceKey, string>;
  potential: (resource: string) => string;
  energy: string;
  efficiency: string;
  production: (resource: string) => string;
  storage: (resource: string) => string;
  buildingDuration: string;
  shipDuration: string;
  researchDuration: string;
  fields: string;
};

/** Libellés des effets d'amélioration, par langue (le français est la langue source). */
const EFFECT_TEXTS: Record<string, EffectTexts> = {
  fr: {
    resources: { metal: "Métal", crystal: "Cristal", deuterium: "Deutérium" },
    potential: (r) => `${r} à pleine puissance`,
    energy: "Solde d’énergie de la planète",
    efficiency: "Rendement des mines",
    production: (r) => `${r} réellement produit sur la planète`,
    storage: (r) => `Stockage de ${r.toLowerCase()}`,
    buildingDuration: "Durée des futures constructions",
    shipDuration: "Durée des futurs vaisseaux et défenses",
    researchDuration: "Durée des futures recherches",
    fields: "Cases libres sur la planète",
  },
  en: {
    resources: { metal: "Metal", crystal: "Crystal", deuterium: "Deuterium" },
    potential: (r) => `${r} at full power`,
    energy: "Planet energy balance",
    efficiency: "Mine efficiency",
    production: (r) => `${r} actually produced on the planet`,
    storage: (r) => `${r} storage`,
    buildingDuration: "Duration of future constructions",
    shipDuration: "Duration of future ships and defences",
    researchDuration: "Duration of future research",
    fields: "Free fields on the planet",
  },
  es: {
    resources: { metal: "Metal", crystal: "Cristal", deuterium: "Deuterio" },
    potential: (r) => `${r} a plena potencia`,
    energy: "Balance de energía del planeta",
    efficiency: "Rendimiento de las minas",
    production: (r) => `${r} realmente producido en el planeta`,
    storage: (r) => `Almacenamiento de ${r.toLowerCase()}`,
    buildingDuration: "Duración de las futuras construcciones",
    shipDuration: "Duración de las futuras naves y defensas",
    researchDuration: "Duración de las futuras investigaciones",
    fields: "Casillas libres en el planeta",
  },
  de: {
    resources: { metal: "Metall", crystal: "Kristall", deuterium: "Deuterium" },
    potential: (r) => `${r} bei voller Leistung`,
    energy: "Energiebilanz des Planeten",
    efficiency: "Effizienz der Minen",
    production: (r) => `${r} tatsächlich auf dem Planeten produziert`,
    storage: (r) => `${r}-Lager`,
    buildingDuration: "Dauer künftiger Bauten",
    shipDuration: "Dauer künftiger Schiffe und Verteidigungsanlagen",
    researchDuration: "Dauer künftiger Forschungen",
    fields: "Freie Felder auf dem Planeten",
  },
  it: {
    resources: { metal: "Metallo", crystal: "Cristallo", deuterium: "Deuterio" },
    potential: (r) => `${r} a piena potenza`,
    energy: "Bilancio energetico del pianeta",
    efficiency: "Resa delle miniere",
    production: (r) => `${r} effettivamente prodotto sul pianeta`,
    storage: (r) => `Stoccaggio di ${r.toLowerCase()}`,
    buildingDuration: "Durata delle future costruzioni",
    shipDuration: "Durata delle future navi e difese",
    researchDuration: "Durata delle future ricerche",
    fields: "Caselle libere sul pianeta",
  },
};
const texts = () => EFFECT_TEXTS[currentLocale()] ?? EFFECT_TEXTS.fr;

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
      texts().potential(texts().resources[mineResource]),
      "perHour",
      calculateMineProduction(planet)[mineResource] * multiplier,
      calculateMineProduction(nextPlanet)[mineResource] * multiplier,
      true,
    );
  }
  if ([1, 2, 3, 4, 12].includes(buildingId)) {
    add(
      "energy",
      texts().energy,
      "energy",
      current.energy.available - current.energy.used,
      next.energy.available - next.energy.used,
      true,
    );
    add(
      "efficiency",
      texts().efficiency,
      "percent",
      current.energy.productionLevel,
      next.energy.productionLevel,
    );
    for (const resource of ["metal", "crystal", "deuterium"] as const) {
      add(
        `production-${resource}`,
        texts().production(texts().resources[resource]),
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
      texts().storage(texts().resources[storageResource]),
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
      texts().buildingDuration,
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
      texts().shipDuration,
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
      texts().researchDuration,
      "percent",
      100,
      (100 * (currentLevel + 1)) / (nextLevel + 1),
      true,
      true,
    );
  }
  if (buildingId === TERRAFORMER_ID) {
    add(
      "fields",
      texts().fields,
      "fields",
      planet.fieldsMax - planet.fieldsUsed,
      planet.fieldsMax - planet.fieldsUsed + TERRAFORMER_FIELDS_PER_LEVEL,
    );
  } else if (!storageResource) {
    add(
      "fields",
      texts().fields,
      "fields",
      planet.fieldsMax - planet.fieldsUsed,
      planet.fieldsMax - planet.fieldsUsed - 1,
    );
  }
  const levelsAfter = { ...buildingLevels, [buildingId]: nextLevel };
  const candidates = [
    ...IMPLEMENTED_BUILDINGS.map((id) => BUILDINGS[id]),
    ...IMPLEMENTED_TECHNOLOGIES.map((id) => TECHNOLOGIES[id]),
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
    .map((item) => itemName(item));
  return {
    nextLevel,
    effects,
    unlocks,
    energyLimited: next.energy.productionLevel < 100,
  };
}
