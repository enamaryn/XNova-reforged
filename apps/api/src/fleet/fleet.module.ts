import { Module } from '@nestjs/common';
import { GameEventsModule } from '../game-events/game-events.module';
import { FleetController } from './fleet.controller';
import { FleetCronService } from './fleet-cron.service';
import { FleetService } from './fleet.service';

@Module({
  imports: [GameEventsModule],
  controllers: [FleetController],
  providers: [FleetService, FleetCronService],
})
export class FleetModule {}
