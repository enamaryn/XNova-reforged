import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BuildingsService } from './buildings.service';

@Injectable()
export class BuildingsCronService {
  private readonly logger = new Logger(BuildingsCronService.name);

  constructor(private readonly buildingsService: BuildingsService) {}

  /**
   * Verifie toutes les 10 secondes si des constructions sont terminees
   * et les finalise automatiquement
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCompletedBuildings() {
    try {
      const completedBuildings =
        await this.buildingsService.getCompletedConstructions();

      if (completedBuildings.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${completedBuildings.length} completed construction(s)`,
      );

      // Traiter chaque construction terminee
      const results = await Promise.allSettled(
        completedBuildings.map((entry) =>
          this.buildingsService.completeConstruction({
            id: entry.id,
            planetId: entry.planetId,
            buildingId: entry.buildingId,
            level: entry.level,
          }),
        ),
      );

      // Logger les resultats
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        this.logger.warn(
          `Buildings completed: ${succeeded} succeeded, ${failed} failed`,
        );
        // Logger les erreurs
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            this.logger.error(
              `Failed to complete building ${completedBuildings[i].id}: ${r.reason}`,
            );
          }
        });
      } else {
        this.logger.log(`Successfully completed ${succeeded} building(s)`);
      }
    } catch (error) {
      this.logger.error('Error in buildings cron job:', error);
    }
  }
}
