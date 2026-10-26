import { Module } from '@nestjs/common';
import { AdminBossController, BossController } from './boss.controller';
import { BossCronService } from './boss-cron.service';
import { BossService } from './boss.service';

@Module({
  controllers: [BossController, AdminBossController],
  providers: [BossService, BossCronService],
  exports: [BossService],
})
export class BossModule {}
