import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoredCron } from '../supervision/cron-registry';
import { InvasionService } from './invasions.service';

@Injectable()
export class InvasionCronService {
  private readonly logger = new Logger(InvasionCronService.name);

  constructor(private readonly invasions: InvasionService) {}

  /** Chaque minute : bonus à offrir, échéance, régénération de la vague en cours, lancement automatique. */
  @Cron(CronExpression.EVERY_MINUTE)
  @MonitoredCron('invasions', 60000)
  async tick() {
    try {
      await this.invasions.tick();
    } catch (error) {
      this.logger.error('Error in invasions cron job:', error);
    }
  }
}
