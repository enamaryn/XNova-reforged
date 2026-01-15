import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShipyardService } from './shipyard.service';

@Injectable()
export class ShipyardCronService {
  private readonly logger = new Logger(ShipyardCronService.name);

  constructor(private readonly shipyardService: ShipyardService) {}

  /**
   * Verifie toutes les 10 secondes les constructions de vaisseaux terminees
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCompletedBuilds() {
    try {
      const completedBuilds = await this.shipyardService.getCompletedBuilds();

      if (completedBuilds.length === 0) {
        return;
      }

      this.logger.log(`Found ${completedBuilds.length} completed ship build(s)`);

      const results = await Promise.allSettled(
        completedBuilds.map((entry) =>
          this.shipyardService.completeBuild({
            id: entry.id,
            planetId: entry.planetId,
            shipId: entry.shipId,
            amount: entry.amount,
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        this.logger.warn(
          `Shipyard completed: ${succeeded} succeeded, ${failed} failed`,
        );
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            this.logger.error(
              `Failed to complete ship build ${completedBuilds[index].id}: ${result.reason}`,
            );
          }
        });
      } else {
        this.logger.log(`Successfully completed ${succeeded} ship build(s)`);
      }
    } catch (error) {
      this.logger.error('Error in shipyard cron job:', error);
    }
  }
}
