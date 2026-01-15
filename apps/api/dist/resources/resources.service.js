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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const game_engine_1 = require("@xnova/game-engine");
const database_service_1 = require("../database/database.service");
let ResourcesService = class ResourcesService {
    constructor(database, configService) {
        this.database = database;
        this.configService = configService;
    }
    async getPlanet(planetId, userId) {
        const { planet, calculation } = await this.refreshPlanet(planetId, userId);
        return {
            ...planet,
            storage: calculation.storage,
            productionLevel: calculation.energy.productionLevel,
        };
    }
    async getPlanetResources(planetId, userId) {
        const { planet, calculation } = await this.refreshPlanet(planetId, userId);
        return {
            planetId: planet.id,
            resources: {
                metal: planet.metal,
                crystal: planet.crystal,
                deuterium: planet.deuterium,
            },
            production: {
                metal: planet.metalProduction,
                crystal: planet.crystalProduction,
                deuterium: planet.deuteriumProduction,
            },
            energy: {
                used: planet.energyUsed,
                available: planet.energyAvailable,
                productionLevel: calculation.energy.productionLevel,
            },
            storage: calculation.storage,
            lastUpdate: planet.lastUpdate,
        };
    }
    async refreshPlanet(planetId, userId) {
        const planet = await this.database.planet.findUnique({
            where: { id: planetId },
        });
        if (!planet) {
            throw new common_1.NotFoundException('Planete introuvable');
        }
        if (planet.userId !== userId) {
            throw new common_1.ForbiddenException('Acces refuse');
        }
        const calculation = (0, game_engine_1.updateResources)({
            resources: this.mapResources(planet),
            levels: this.mapLevels(planet),
            lastUpdate: planet.lastUpdate,
            now: new Date(),
            config: this.buildConfig(),
        });
        const updatedPlanet = await this.database.planet.update({
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
        return {
            planet: updatedPlanet,
            calculation,
        };
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
exports.ResourcesService = ResourcesService;
exports.ResourcesService = ResourcesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        config_1.ConfigService])
], ResourcesService);
//# sourceMappingURL=resources.service.js.map