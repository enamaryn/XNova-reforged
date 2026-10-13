import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoredCron } from '../supervision/cron-registry';
import { MarketService } from './market.service';

@Injectable()
export class MarketCronService {
  private readonly logger = new Logger(MarketCronService.name);

  constructor(private readonly market: MarketService) {}

  /** Chaque minute : ferme les offres expirées et rend le séquestre à leurs vendeurs. */
  @Cron(CronExpression.EVERY_MINUTE)
  @MonitoredCron('market', 60000)
  async handleExpiry() {
    try {
      await this.market.expireDue();
    } catch (error) {
      this.logger.error('Error in market cron job:', error);
    }
  }
}
