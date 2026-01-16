import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';
export declare class ResourcesService {
    private readonly database;
    private readonly serverConfig;
    constructor(database: DatabaseService, serverConfig: ServerConfigService);
    getPlanet(planetId: string, userId: string): Promise<{
        storage: import("@xnova/game-engine").StorageCapacity;
        productionLevel: number;
        id: string;
        name: string;
        userId: string;
        createdAt: Date;
        galaxy: number;
        system: number;
        position: number;
        planetType: string;
        metal: number;
        crystal: number;
        deuterium: number;
        metalProduction: number;
        crystalProduction: number;
        deuteriumProduction: number;
        energyUsed: number;
        energyAvailable: number;
        fieldsUsed: number;
        fieldsMax: number;
        metalMine: number;
        crystalMine: number;
        deuteriumMine: number;
        solarPlant: number;
        fusionPlant: number;
        roboticsFactory: number;
        naniteFactory: number;
        shipyard: number;
        metalStorage: number;
        crystalStorage: number;
        deuteriumStorage: number;
        researchLab: number;
        terraformer: number;
        allianceDepot: number;
        missileSilo: number;
        moonBase: number;
        phalanx: number;
        jumpGate: number;
        lastUpdate: Date;
    }>;
    getPlanetResources(planetId: string, userId: string): Promise<{
        planetId: string;
        resources: {
            metal: number;
            crystal: number;
            deuterium: number;
        };
        production: {
            metal: number;
            crystal: number;
            deuterium: number;
        };
        energy: {
            used: number;
            available: number;
            productionLevel: number;
        };
        storage: import("@xnova/game-engine").StorageCapacity;
        lastUpdate: Date;
    }>;
    renamePlanet(planetId: string, userId: string, name: string): Promise<{
        id: string;
        name: string;
        galaxy: number;
        system: number;
        position: number;
    }>;
    scanPlanet(planetId: string): Promise<{
        id: string;
        name: string;
        galaxy: number;
        system: number;
        position: number;
        owner: string;
        resources: {
            metal: number;
            crystal: number;
            deuterium: number;
        };
    }>;
    colonizePlanet(params: {
        userId: string;
        originPlanetId: string;
        galaxy: number;
        system: number;
        position: number;
        name: string;
    }): Promise<{
        success: boolean;
        planetId: string;
        galaxy: number;
        system: number;
        position: number;
        name: string;
    }>;
    private refreshPlanet;
    private mapResources;
    private mapLevels;
    private buildConfig;
}
