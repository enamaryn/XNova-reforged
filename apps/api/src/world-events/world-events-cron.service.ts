import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoredCron } from '../supervision/cron-registry';
import { WorldEventsService } from './world-events.service';

@Injectable()
export class WorldEventsCronService {
  private readonly logger = new Logger(WorldEventsCronService.name);

  constructor(private readonly events: WorldEventsService) {}

  /** Chaque minute : termine les événements échus et lance ceux dont la case « automatique » est cochée. */
  @Cron(CronExpression.EVERY_MINUTE)
  @MonitoredCron('world-events', 60000)
  async handleTick() {
    try {
      const result = await this.events.tick();
      if (result.ended || result.launched) {
        this.logger.log(`Événements du monde : ${result.launched} lancé(s), ${result.ended} terminé(s)`);
      }
    } catch (error) {
      this.logger.error('Error in world events cron job:', error);
    }
  }
}
