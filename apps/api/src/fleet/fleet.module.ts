import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { GameEventsModule } from '../game-events/game-events.module';
import { FleetController } from './fleet.controller';
import { FleetCronService } from './fleet-cron.service';
import { FleetService } from './fleet.service';

@Module({
  imports: [GameEventsModule, CombatModule],
  controllers: [FleetController],
  providers: [FleetService, FleetCronService],
})
export class FleetModule {}
