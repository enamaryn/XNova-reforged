"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMineProduction = calculateMineProduction;
exports.calculateEnergyBalance = calculateEnergyBalance;
exports.calculateProductionLevel = calculateProductionLevel;
exports.calculateStorageCapacity = calculateStorageCapacity;
exports.updateResources = updateResources;
const DEFAULT_CONFIG = {
    baseIncome: { metal: 20, crystal: 10, deuterium: 0 },
    resourceMultiplier: 1,
    gameSpeed: 1,
    storageBase: 1_000_000,
    storageFactor: 1.5,
    storageOverflow: 1.1,
};
function calculateMineProduction(levels) {
    return {
        metal: calculateMineOutput(30, levels.metalMine),
        crystal: calculateMineOutput(20, levels.crystalMine),
        deuterium: calculateMineOutput(10, levels.deuteriumMine),
    };
}
function calculateEnergyBalance(levels) {
    const used = calculateMineOutput(10, levels.metalMine) +
        calculateMineOutput(10, levels.crystalMine) +
        calculateMineOutput(20, levels.deuteriumMine);
    const available = calculateMineOutput(20, levels.solarPlant) +
        calculateFusionOutput(levels.fusionPlant);
    return {
        used: Math.floor(used),
        available: Math.floor(available),
    };
}
function calculateProductionLevel(available, used) {
    if (available <= 0)
        return 0;
    if (used <= 0)
        return 100;
    if (available >= used)
        return 100;
    return Math.max(0, Math.min(100, Math.floor((available / used) * 100)));
}
function calculateStorageCapacity(levels, config = DEFAULT_CONFIG) {
    const metal = calculateStorage(levels.metalStorage, config);
    const crystal = calculateStorage(levels.crystalStorage, config);
    const deuterium = calculateStorage(levels.deuteriumStorage, config);
    return {
        metal: Math.floor(metal),
        crystal: Math.floor(crystal),
        deuterium: Math.floor(deuterium),
    };
}
function updateResources(input) {
    const config = { ...DEFAULT_CONFIG, ...input.config };
    const seconds = Math.max(0, (input.now.getTime() - input.lastUpdate.getTime()) / 1000);
    const baseProduction = calculateMineProduction(input.levels);
    const energyBalance = calculateEnergyBalance(input.levels);
    const productionLevel = calculateProductionLevel(energyBalance.available, energyBalance.used);
    const productionMultiplier = config.resourceMultiplier * config.gameSpeed;
    const adjustedProduction = applyProductionMultiplier(baseProduction, productionMultiplier, productionLevel);
    const baseIncome = applyBaseIncome(config.baseIncome, productionMultiplier);
    const produced = calculateProducedResources(adjustedProduction, baseIncome, seconds);
    const storage = calculateStorageCapacity(input.levels, config);
    const maxStorage = {
        metal: storage.metal * config.storageOverflow,
        crystal: storage.crystal * config.storageOverflow,
        deuterium: storage.deuterium * config.storageOverflow,
    };
    return {
        resources: {
            metal: clampResource(input.resources.metal + produced.metal, maxStorage.metal),
            crystal: clampResource(input.resources.crystal + produced.crystal, maxStorage.crystal),
            deuterium: clampResource(input.resources.deuterium + produced.deuterium, maxStorage.deuterium),
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
function calculateMineOutput(base, level) {
    if (level <= 0)
        return 0;
    return base * level * Math.pow(1.1, level);
}
function calculateFusionOutput(level) {
    if (level <= 0)
        return 0;
    return 30 * level * Math.pow(1.05, level);
}
function calculateStorage(level, config) {
    return config.storageBase * Math.pow(config.storageFactor, level);
}
function applyProductionMultiplier(production, multiplier, productionLevel) {
    const factor = (productionLevel / 100) * multiplier;
    return {
        metal: production.metal * factor,
        crystal: production.crystal * factor,
        deuterium: production.deuterium * factor,
    };
}
function applyBaseIncome(baseIncome, multiplier) {
    return {
        metal: baseIncome.metal * multiplier,
        crystal: baseIncome.crystal * multiplier,
        deuterium: baseIncome.deuterium * multiplier,
    };
}
function calculateProducedResources(productionPerHour, baseIncomePerHour, seconds) {
    const hours = seconds / 3600;
    return {
        metal: productionPerHour.metal * hours + baseIncomePerHour.metal * hours,
        crystal: productionPerHour.crystal * hours + baseIncomePerHour.crystal * hours,
        deuterium: productionPerHour.deuterium * hours + baseIncomePerHour.deuterium * hours,
    };
}
function clampResource(value, max) {
    if (value < 0)
        return 0;
    if (value > max)
        return Math.floor(max);
    return Math.floor(value);
}
