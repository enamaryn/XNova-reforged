export interface ResourceConfig {
  baseIncome: ProductionRates;
  resourceMultiplier: number;
  gameSpeed: number;
  storageBase: number;
  storageFactor: number;
  storageOverflow: number;
}

export interface ProductionRates {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface ResourceLevels {
  metalMine: number;
  crystalMine: number;
  deuteriumMine: number;
  solarPlant: number;
  fusionPlant: number;
  metalStorage: number;
  crystalStorage: number;
  deuteriumStorage: number;
}

export interface ResourceState {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface EnergyState {
  used: number;
  available: number;
  productionLevel: number;
}

export interface StorageCapacity {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface ResourceUpdateInput {
  resources: ResourceState;
  levels: ResourceLevels;
  lastUpdate: Date;
  now: Date;
  config?: Partial<ResourceConfig>;
}

export interface ResourceUpdateResult {
  resources: ResourceState;
  productionPerHour: ProductionRates;
  energy: EnergyState;
  storage: StorageCapacity;
  lastUpdate: Date;
}

const DEFAULT_CONFIG: ResourceConfig = {
  baseIncome: { metal: 20, crystal: 10, deuterium: 0 },
  resourceMultiplier: 1,
  gameSpeed: 1,
  storageBase: 1_000_000,
  storageFactor: 1.5,
  storageOverflow: 1.1,
};

export function calculateMineProduction(levels: ResourceLevels): ProductionRates {
  return {
    metal: calculateMineOutput(30, levels.metalMine),
    crystal: calculateMineOutput(20, levels.crystalMine),
    deuterium: calculateMineOutput(10, levels.deuteriumMine),
  };
}

export function calculateEnergyBalance(levels: ResourceLevels) {
  const used =
    calculateMineOutput(10, levels.metalMine) +
    calculateMineOutput(10, levels.crystalMine) +
    calculateMineOutput(20, levels.deuteriumMine);

  const available =
    calculateMineOutput(20, levels.solarPlant) +
    calculateFusionOutput(levels.fusionPlant);

  return {
    used: Math.floor(used),
    available: Math.floor(available),
  };
}

export function calculateProductionLevel(available: number, used: number) {
  if (available <= 0) return 0;
  if (used <= 0) return 100;
  if (available >= used) return 100;
  return Math.max(0, Math.min(100, Math.floor((available / used) * 100)));
}

export function calculateStorageCapacity(
  levels: ResourceLevels,
  config: ResourceConfig = DEFAULT_CONFIG
): StorageCapacity {
  const metal = calculateStorage(levels.metalStorage, config);
  const crystal = calculateStorage(levels.crystalStorage, config);
  const deuterium = calculateStorage(levels.deuteriumStorage, config);

  return {
    metal: Math.floor(metal),
    crystal: Math.floor(crystal),
    deuterium: Math.floor(deuterium),
  };
}

export function updateResources(input: ResourceUpdateInput): ResourceUpdateResult {
  const config = { ...DEFAULT_CONFIG, ...input.config };
  const seconds = Math.max(
    0,
    (input.now.getTime() - input.lastUpdate.getTime()) / 1000
  );

  const baseProduction = calculateMineProduction(input.levels);
  const energyBalance = calculateEnergyBalance(input.levels);
  const productionLevel = calculateProductionLevel(
    energyBalance.available,
    energyBalance.used
  );

  const productionMultiplier = config.resourceMultiplier * config.gameSpeed;
  const adjustedProduction = applyProductionMultiplier(
    baseProduction,
    productionMultiplier,
    productionLevel
  );
  const baseIncome = applyBaseIncome(config.baseIncome, productionMultiplier);

  const produced = calculateProducedResources(
    adjustedProduction,
    baseIncome,
    seconds
  );

  const storage = calculateStorageCapacity(input.levels, config);
  const maxStorage = {
    metal: storage.metal * config.storageOverflow,
    crystal: storage.crystal * config.storageOverflow,
    deuterium: storage.deuterium * config.storageOverflow,
  };

  return {
    resources: {
      metal: clampResource(input.resources.metal + produced.metal, maxStorage.metal),
      crystal: clampResource(
        input.resources.crystal + produced.crystal,
        maxStorage.crystal
      ),
      deuterium: clampResource(
        input.resources.deuterium + produced.deuterium,
        maxStorage.deuterium
      ),
    },
    productionPerHour: {
      metal: adjustedProduction.metal + baseIncome.metal,
      crystal: adjustedProduction.crystal + baseIncome.crystal,
      deuterium: adjustedProduction.deuterium + baseIncome.deuterium,
    },
    energy: {
      used: energyBalance.used,
      available: energyBalance.available,
      productionLevel,
    },
    storage,
    lastUpdate: input.now,
  };
}

function calculateMineOutput(base: number, level: number) {
  if (level <= 0) return 0;
  return base * level * Math.pow(1.1, level);
}

function calculateFusionOutput(level: number) {
  if (level <= 0) return 0;
  return 30 * level * Math.pow(1.05, level);
}

function calculateStorage(level: number, config: ResourceConfig) {
  return config.storageBase * Math.pow(config.storageFactor, level);
}

function applyProductionMultiplier(
  production: ProductionRates,
  multiplier: number,
  productionLevel: number
): ProductionRates {
  const factor = (productionLevel / 100) * multiplier;
  return {
    metal: production.metal * factor,
    crystal: production.crystal * factor,
    deuterium: production.deuterium * factor,
  };
}

function applyBaseIncome(baseIncome: ProductionRates, multiplier: number) {
  return {
    metal: baseIncome.metal * multiplier,
    crystal: baseIncome.crystal * multiplier,
    deuterium: baseIncome.deuterium * multiplier,
  };
}

function calculateProducedResources(
  productionPerHour: ProductionRates,
  baseIncomePerHour: ProductionRates,
  seconds: number
): ProductionRates {
  const hours = seconds / 3600;
  return {
    metal: productionPerHour.metal * hours + baseIncomePerHour.metal * hours,
    crystal: productionPerHour.crystal * hours + baseIncomePerHour.crystal * hours,
    deuterium: productionPerHour.deuterium * hours + baseIncomePerHour.deuterium * hours,
  };
}

function clampResource(value: number, max: number) {
  if (value < 0) return 0;
  if (value > max) return Math.floor(max);
  return Math.floor(value);
}
