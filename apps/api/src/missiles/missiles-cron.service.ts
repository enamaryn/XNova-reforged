import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoredCron } from '../supervision/cron-registry';
import { MissilesService } from './missiles.service';

@Injectable()
export class MissilesCronService {
  private readonly logger = new Logger(MissilesCronService.name);

  constructor(private readonly missiles: MissilesService) {}

  /** Résout toutes les 10 secondes les frappes de missiles arrivées. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  @MonitoredCron('missiles', 10000)
  async handleMissiles() {
    try {
      await this.missiles.resolveDue();
    } catch (error) {
      this.logger.error('Error in missiles cron job:', error);
    }
  }
}
