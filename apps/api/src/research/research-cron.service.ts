import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ResearchService } from './research.service';

@Injectable()
export class ResearchCronService {
  private readonly logger = new Logger(ResearchCronService.name);

  constructor(private readonly researchService: ResearchService) {}

  /**
   * Verifie toutes les 10 secondes si des recherches sont terminees
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCompletedResearch() {
    try {
      const completedResearch = await this.researchService.getCompletedResearch();

      if (completedResearch.length === 0) {
        return;
      }

      this.logger.log(`Found ${completedResearch.length} completed research(es)`);

      const results = await Promise.allSettled(
        completedResearch.map((entry) =>
          this.researchService.completeResearch({
            id: entry.id,
            userId: entry.userId,
            techId: entry.techId,
            level: entry.level,
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        this.logger.warn(
          `Research completed: ${succeeded} succeeded, ${failed} failed`,
        );
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            this.logger.error(
              `Failed to complete research ${completedResearch[i].id}: ${r.reason}`,
            );
          }
        });
      } else {
        this.logger.log(`Successfully completed ${succeeded} research(es)`);
      }
    } catch (error) {
      this.logger.error('Error in research cron job:', error);
    }
  }
}
