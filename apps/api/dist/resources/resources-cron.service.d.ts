import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ServerConfigService } from '../server-config/server-config.service';
export declare class ResourcesCronService {
    private readonly database;
    private readonly serverConfig;
    private readonly gameEventsGateway;
    private readonly logger;
    constructor(database: DatabaseService, serverConfig: ServerConfigService, gameEventsGateway: GameEventsGateway);
    updateAllPlanetsResources(): Promise<void>;
    updateInactivePlanetsResources(): Promise<void>;
    private mapResources;
    private mapLevels;
    private buildConfig;
}
