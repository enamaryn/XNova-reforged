import { Module } from '@nestjs/common';
import { GameEventsModule } from '../game-events/game-events.module';
import { ServerConfigModule } from '../server-config/server-config.module';
import { ResearchController } from './research.controller';
import { ResearchCronService } from './research-cron.service';
import { ResearchService } from './research.service';

@Module({
  imports: [GameEventsModule, ServerConfigModule],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchCronService],
  exports: [ResearchService],
})
export class ResearchModule {}
