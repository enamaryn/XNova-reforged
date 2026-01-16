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
const game_engine_1 = require("@xnova/game-engine");
const game_config_1 = require("@xnova/game-config");
const database_service_1 = require("../database/database.service");
const server_config_service_1 = require("../server-config/server-config.service");
let ResourcesService = class ResourcesService {
    constructor(database, serverConfig) {
        this.database = database;
        this.serverConfig = serverConfig;
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
    async renamePlanet(planetId, userId, name) {
        const planet = await this.database.planet.findUnique({
            where: { id: planetId },
        });
        if (!planet) {
            throw new common_1.NotFoundException('Planete introuvable');
        }
        if (planet.userId !== userId) {
            throw new common_1.ForbiddenException('Acces refuse');
        }
        const updated = await this.database.planet.update({
            where: { id: planetId },
            data: { name },
            select: {
                id: true,
                name: true,
                galaxy: true,
                system: true,
                position: true,
            },
        });
        return updated;
    }
    async scanPlanet(planetId) {
        const planet = await this.database.planet.findUnique({
            where: { id: planetId },
            include: {
                user: { select: { id: true, username: true } },
            },
        });
        if (!planet) {
            throw new common_1.NotFoundException('Planete introuvable');
        }
        return {
            id: planet.id,
            name: planet.name,
            galaxy: planet.galaxy,
            system: planet.system,
            position: planet.position,
            owner: planet.user?.username ?? 'Inconnu',
            resources: {
                metal: planet.metal,
                crystal: planet.crystal,
                deuterium: planet.deuterium,
            },
        };
    }
    async colonizePlanet(params) {
        const { userId, originPlanetId, galaxy, system, position, name } = params;
        if (galaxy < 1 ||
            galaxy > game_config_1.GAME_CONSTANTS.MAX_GALAXIES ||
            system < 1 ||
            system > game_config_1.GAME_CONSTANTS.MAX_SYSTEMS ||
            position < 1 ||
            position > game_config_1.GAME_CONSTANTS.MAX_POSITIONS) {
            throw new common_1.BadRequestException('Coordonnees invalides');
        }
        const planetCount = await this.database.planet.count({
            where: { userId },
        });
        if (planetCount >= game_config_1.GAME_CONSTANTS.MAX_PLAYER_PLANETS) {
            throw new common_1.BadRequestException('Nombre maximal de planetes atteint');
        }
        const origin = await this.database.planet.findUnique({
            where: { id: originPlanetId },
        });
        if (!origin) {
            throw new common_1.NotFoundException('Planete d\'origine introuvable');
        }
        if (origin.userId !== userId) {
            throw new common_1.ForbiddenException('Acces refuse');
        }
        const existing = await this.database.planet.findUnique({
            where: {
                galaxy_system_position: {
                    galaxy,
                    system,
                    position,
                },
            },
        });
        if (existing) {
            throw new common_1.BadRequestException('Position deja occupee');
        }
        const colonizer = await this.database.ship.findUnique({
            where: {
                planetId_shipId: {
                    planetId: originPlanetId,
                    shipId: 208,
                },
            },
        });
        if (!colonizer || colonizer.amount < 1) {
            throw new common_1.BadRequestException('Vaisseau de colonisation requis');
        }
        const planetName = name?.trim() || 'Colonie';
        const config = await this.serverConfig.getConfig();
        const [createdPlanet] = await this.database.$transaction([
            this.database.planet.create({
                data: {
                    userId,
                    name: planetName,
                    galaxy,
                    system,
                    position,
                    planetType: 'normal',
                    metal: game_config_1.GAME_CONSTANTS.STARTING_METAL,
                    crystal: game_config_1.GAME_CONSTANTS.STARTING_CRYSTAL,
                    deuterium: game_config_1.GAME_CONSTANTS.STARTING_DEUTERIUM,
                    fieldsMax: config.planetSize,
                    fieldsUsed: 0,
                },
            }),
            this.database.ship.update({
                where: { planetId_shipId: { planetId: originPlanetId, shipId: 208 } },
                data: { amount: { decrement: 1 } },
            }),
        ]);
        return {
            success: true,
            planetId: createdPlanet.id,
            galaxy,
            system,
            position,
            name: createdPlanet.name,
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
            config: await this.buildConfig(),
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
        return this.serverConfig.getResourceConfig();
    }
};
exports.ResourcesService = ResourcesService;
exports.ResourcesService = ResourcesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        server_config_service_1.ServerConfigService])
], ResourcesService);
//# sourceMappingURL=resources.service.js.map