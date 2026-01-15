import { Module } from '@nestjs/common';
import { GameEventsModule } from '../game-events/game-events.module';
import { ResearchController } from './research.controller';
import { ResearchCronService } from './research-cron.service';
import { ResearchService } from './research.service';

@Module({
  imports: [GameEventsModule],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchCronService],
  exports: [ResearchService],
})
export class ResearchModule {}
