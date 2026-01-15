import { Module } from '@nestjs/common';
import { GameEventsModule } from '../game-events/game-events.module';
import { CombatController } from './combat.controller';
import { CombatService } from './combat.service';

@Module({
  imports: [GameEventsModule],
  controllers: [CombatController],
  providers: [CombatService],
  exports: [CombatService],
})
export class CombatModule {}
