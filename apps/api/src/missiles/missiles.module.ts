import { Module } from '@nestjs/common';
import { GameEventsModule } from '../game-events/game-events.module';
import { ServerConfigModule } from '../server-config/server-config.module';
import { MissilesController } from './missiles.controller';
import { MissilesCronService } from './missiles-cron.service';
import { MissilesService } from './missiles.service';

@Module({
  imports: [GameEventsModule, ServerConfigModule],
  controllers: [MissilesController],
  providers: [MissilesService, MissilesCronService],
})
export class MissilesModule {}
