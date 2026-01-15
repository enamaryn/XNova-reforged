import { Module } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { BuildingsController } from './buildings.controller';
import { BuildingsCronService } from './buildings-cron.service';
import { GameEventsModule } from '../game-events/game-events.module';

@Module({
  imports: [GameEventsModule],
  controllers: [BuildingsController],
  providers: [BuildingsService, BuildingsCronService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
