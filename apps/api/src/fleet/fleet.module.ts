import { Module } from '@nestjs/common';
import { BossModule } from '../boss/boss.module';
import { CombatModule } from '../combat/combat.module';
import { GameEventsModule } from '../game-events/game-events.module';
import { ServerConfigModule } from '../server-config/server-config.module';
import { ExpeditionController } from './expedition.controller';
import { ExpeditionService } from './expedition.service';
import { FleetController } from './fleet.controller';
import { FleetCronService } from './fleet-cron.service';
import { FleetService } from './fleet.service';
import { ColonizationService } from './colonization.service';
import { SpyController } from './spy.controller';
import { SpyService } from './spy.service';

@Module({
  imports: [GameEventsModule, CombatModule, ServerConfigModule, BossModule],
  controllers: [FleetController, SpyController, ExpeditionController],
  providers: [FleetService, FleetCronService, SpyService, ColonizationService, ExpeditionService],
})
export class FleetModule {}
