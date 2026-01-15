import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
export declare class ResourcesService {
    private readonly database;
    private readonly configService;
    constructor(database: DatabaseService, configService: ConfigService);
    getPlanet(planetId: string, userId: string): Promise<{
        storage: import("@xnova/game-engine").StorageCapacity;
        productionLevel: number;
        id: string;
        createdAt: Date;
        name: string;
        userId: string;
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
    private refreshPlanet;
    private mapResources;
    private mapLevels;
    private buildConfig;
    private getNumber;
}
