"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ResourcesCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const database_service_1 = require("../database/database.service");
const game_events_gateway_1 = require("../game-events/game-events.gateway");
const game_engine_1 = require("@xnova/game-engine");
let ResourcesCronService = ResourcesCronService_1 = class ResourcesCronService {
    constructor(database, configService, gameEventsGateway) {
        this.database = database;
        this.configService = configService;
        this.gameEventsGateway = gameEventsGateway;
        this.logger = new common_1.Logger(ResourcesCronService_1.name);
    }
    async updateAllPlanetsResources() {
        const startTime = Date.now();
        this.logger.debug('Starting resource update for all active planets');
        try {
            const activePlanets = await this.database.planet.findMany({
                where: {
                    user: {
                        lastActive: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                        },
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                        },
                    },
                },
            });
            this.logger.debug(`Found ${activePlanets.length} active planets to update`);
            const now = new Date();
            const config = this.buildConfig();
            const updatePromises = activePlanets.map(async (planet) => {
                try {
                    const calculation = (0, game_engine_1.updateResources)({
                        resources: this.mapResources(planet),
                        levels: this.mapLevels(planet),
                        lastUpdate: planet.lastUpdate,
                        now,
                        config,
                    });
                    await this.database.planet.update({
                        where: { id: planet.id },
                        data: {
                            metal: calculation.resources.metal,
                            crystal: calculation.resources.crystal,
                            deuterium: calculation.resources.deuterium,
                            metalProduction: calculation.productionPerHour.metal,
                            crystalProduction: calculation.productionPerHour.crystal,
                            deuteriumProduction: calculation.productionPerHour.deuterium,
                            energyUsed: calculation.energy.used,
                            energyAvailable: calculation.energy.available,
                            lastUpdate: calculation.lastUpdate,
                        },
                    });
                    this.gameEventsGateway.emitResourcesUpdate(planet.id, {
                        resources: {
                            metal: calculation.resources.metal,
                            crystal: calculation.resources.crystal,
                            deuterium: calculation.resources.deuterium,
                        },
                        production: {
                            metal: calculation.productionPerHour.metal,
                            crystal: calculation.productionPerHour.crystal,
                            deuterium: calculation.productionPerHour.deuterium,
                        },
                        energy: {
                            used: calculation.energy.used,
                            available: calculation.energy.available,
                            productionLevel: calculation.energy.productionLevel,
                        },
                        storage: calculation.storage,
                    });
                    return { success: true, planetId: planet.id };
                }
                catch (error) {
                    this.logger.error(`Error updating planet ${planet.id} (${planet.name}):`, error.message);
                    return { success: false, planetId: planet.id, error: error.message };
                }
            });
            const results = await Promise.allSettled(updatePromises);
            const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
            const errorCount = results.length - successCount;
            const duration = Date.now() - startTime;
            this.logger.log(`Resource update completed in ${duration}ms: ${successCount} success, ${errorCount} errors`);
        }
        catch (error) {
            this.logger.error('Fatal error in resource update cron job:', error);
        }
    }
    async updateInactivePlanetsResources() {
        this.logger.debug('Starting resource update for inactive planets');
        try {
            const inactivePlanets = await this.database.planet.findMany({
                where: {
                    user: {
                        lastActive: {
                            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
                take: 100,
            });
            this.logger.debug(`Found ${inactivePlanets.length} inactive planets to update`);
            const now = new Date();
            const config = this.buildConfig();
            for (const planet of inactivePlanets) {
                try {
                    const calculation = (0, game_engine_1.updateResources)({
                        resources: this.mapResources(planet),
                        levels: this.mapLevels(planet),
                        lastUpdate: planet.lastUpdate,
                        now,
                        config,
                    });
                    await this.database.planet.update({
                        where: { id: planet.id },
                        data: {
                            metal: calculation.resources.metal,
                            crystal: calculation.resources.crystal,
                            deuterium: calculation.resources.deuterium,
                            metalProduction: calculation.productionPerHour.metal,
                            crystalProduction: calculation.productionPerHour.crystal,
                            deuteriumProduction: calculation.productionPerHour.deuterium,
                            energyUsed: calculation.energy.used,
                            energyAvailable: calculation.energy.available,
                            lastUpdate: calculation.lastUpdate,
                        },
                    });
                }
                catch (error) {
                    this.logger.error(`Error updating inactive planet ${planet.id}:`, error.message);
                }
            }
            this.logger.debug('Inactive planets update completed');
        }
        catch (error) {
            this.logger.error('Error in inactive planets update:', error);
        }
    }
    mapResources(planet) {
        return {
            metal: planet.metal,
            crystal: planet.crystal,
            deuterium: planet.deuterium,
        };
    }
    mapLevels(planet) {
        return {
            metalMine: planet.metalMine,
            crystalMine: planet.crystalMine,
            deuteriumMine: planet.deuteriumMine,
            solarPlant: planet.solarPlant,
            fusionPlant: planet.fusionPlant,
            metalStorage: planet.metalStorage,
            crystalStorage: planet.crystalStorage,
            deuteriumStorage: planet.deuteriumStorage,
        };
    }
    buildConfig() {
        return {
            baseIncome: {
                metal: 20,
                crystal: 10,
                deuterium: 0,
            },
            resourceMultiplier: this.getNumber('RESOURCE_MULTIPLIER', 1),
            gameSpeed: this.getNumber('GAME_SPEED', 1),
            storageBase: 1_000_000,
            storageFactor: 1.5,
            storageOverflow: 1.1,
        };
    }
    getNumber(key, fallback) {
        const rawValue = this.configService.get(key);
        if (!rawValue)
            return fallback;
        const parsed = Number(rawValue);
        return Number.isNaN(parsed) ? fallback : parsed;
    }
};
exports.ResourcesCronService = ResourcesCronService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ResourcesCronService.prototype, "updateAllPlanetsResources", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ResourcesCronService.prototype, "updateInactivePlanetsResources", null);
exports.ResourcesCronService = ResourcesCronService = ResourcesCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        config_1.ConfigService,
        game_events_gateway_1.GameEventsGateway])
], ResourcesCronService);
//# sourceMappingURL=resources-cron.service.js.map