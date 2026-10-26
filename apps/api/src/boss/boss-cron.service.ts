import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoredCron } from '../supervision/cron-registry';
import { BossService } from './boss.service';

@Injectable()
export class BossCronService {
  private readonly logger = new Logger(BossCronService.name);

  constructor(private readonly boss: BossService) {}

  /** Chaque minute : apparition du boss (premier ou après la fin du délai) et régénération de sa flotte. */
  @Cron(CronExpression.EVERY_MINUTE)
  @MonitoredCron('boss', 60000)
  async tick() {
    try {
      await this.boss.tick();
    } catch (error) {
      this.logger.error('Error in boss cron job:', error);
    }
  }
}
