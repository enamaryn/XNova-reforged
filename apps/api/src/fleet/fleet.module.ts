import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { GameEventsModule } from '../game-events/game-events.module';
import { ServerConfigModule } from '../server-config/server-config.module';
import { FleetController } from './fleet.controller';
import { FleetCronService } from './fleet-cron.service';
import { FleetService } from './fleet.service';
import { ColonizationService } from './colonization.service';
import { SpyController } from './spy.controller';
import { SpyService } from './spy.service';

@Module({
  imports: [GameEventsModule, CombatModule, ServerConfigModule],
  controllers: [FleetController, SpyController],
  providers: [FleetService, FleetCronService, SpyService, ColonizationService],
})
export class FleetModule {}
