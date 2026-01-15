import { ResourcesService } from './resources.service';
import { RenamePlanetDto } from './dto/rename-planet.dto';
export declare class ResourcesController {
    private readonly resourcesService;
    constructor(resourcesService: ResourcesService);
    getPlanet(planetId: string, userId: string): Promise<{
        storage: import("@xnova/game-engine").StorageCapacity;
        productionLevel: number;
        id: string;
        userId: string;
        name: string;
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
        createdAt: Date;
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
    renamePlanet(planetId: string, dto: RenamePlanetDto, userId: string): Promise<{
        id: string;
        name: string;
        galaxy: number;
        system: number;
        position: number;
    }>;
}
