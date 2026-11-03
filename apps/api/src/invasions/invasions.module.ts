import { Module } from '@nestjs/common';
import { WorldEventsModule } from '../world-events/world-events.module';
import { AdminInvasionController, InvasionController } from './invasions.controller';
import { InvasionCronService } from './invasions-cron.service';
import { InvasionService } from './invasions.service';

@Module({
  imports: [WorldEventsModule],
  controllers: [InvasionController, AdminInvasionController],
  providers: [InvasionService, InvasionCronService],
  exports: [InvasionService],
})
export class InvasionsModule {}
