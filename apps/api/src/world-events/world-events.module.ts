import { Module } from '@nestjs/common';
import { ServerConfigModule } from '../server-config/server-config.module';
import { WorldEventsCronService } from './world-events-cron.service';
import { AdminWorldEventsController, WorldEventsController } from './world-events.controller';
import { WorldEventsService } from './world-events.service';

@Module({
  imports: [ServerConfigModule],
  controllers: [WorldEventsController, AdminWorldEventsController],
  providers: [WorldEventsService, WorldEventsCronService],
  exports: [WorldEventsService],
})
export class WorldEventsModule {}
