import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
export declare class ResourcesCronService {
    private readonly database;
    private readonly configService;
    private readonly gameEventsGateway;
    private readonly logger;
    constructor(database: DatabaseService, configService: ConfigService, gameEventsGateway: GameEventsGateway);
    updateAllPlanetsResources(): Promise<void>;
    updateInactivePlanetsResources(): Promise<void>;
    private mapResources;
    private mapLevels;
    private buildConfig;
    private getNumber;
}
