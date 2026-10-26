import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MonitoredCron } from '../supervision/cron-registry';
import { MultiAccountService } from './multi-account.service';

@Injectable()
export class MultiAccountCronService {
  private readonly logger = new Logger(MultiAccountCronService.name);

  constructor(private readonly multiAccount: MultiAccountService) {}

  /** Chaque nuit : supprime les adresses IP plus anciennes que la durée de conservation. */
  @Cron('0 4 * * *')
  @MonitoredCron('multi-account', 86_400_000)
  async purge() {
    try {
      const removed = await this.multiAccount.purgeOldIps();
      if (removed > 0) this.logger.log(`${removed} adresse(s) IP expirée(s) supprimée(s)`);
    } catch (error) {
      this.logger.error('Error in multi-account cron job:', error);
    }
  }
}
