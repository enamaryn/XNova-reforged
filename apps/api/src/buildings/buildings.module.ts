import { Module } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { BuildingsController } from './buildings.controller';
import { BuildingsCronService } from './buildings-cron.service';
import { GameEventsModule } from '../game-events/game-events.module';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [GameEventsModule, ServerConfigModule],
  controllers: [BuildingsController],
  providers: [BuildingsService, BuildingsCronService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
