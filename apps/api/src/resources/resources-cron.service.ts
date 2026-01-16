import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ServerConfigService } from '../server-config/server-config.service';
import {
  updateResources,
  type ResourceConfig,
  type ResourceLevels,
  type ResourceState,
} from '@xnova/game-engine';

/**
 * Service responsable de la mise à jour périodique des ressources de toutes les planètes
 *
 * Exécute un cron job toutes les minutes pour :
 * - Calculer la production de ressources depuis la dernière mise à jour
 * - Mettre à jour les ressources en base de données
 * - Émettre des événements WebSocket pour les planètes avec des joueurs connectés
 */
@Injectable()
export class ResourcesCronService {
  private readonly logger = new Logger(ResourcesCronService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEventsGateway: GameEventsGateway,
  ) {}

  /**
   * Cron job exécuté toutes les minutes pour mettre à jour les ressources
   *
   * Pour optimiser les performances, on ne met à jour que les planètes
   * dont les joueurs se sont connectés dans les dernières 24h
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async updateAllPlanetsResources() {
    const startTime = Date.now();
    this.logger.debug('Starting resource update for all active planets');

    try {
      // Récupérer toutes les planètes des joueurs actifs (dernière connexion < 24h)
      const activePlanets = await this.database.planet.findMany({
        where: {
          user: {
            lastActive: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Dernières 24h
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      this.logger.debug(`Found ${activePlanets.length} active planets to update`);

      const now = new Date();
      const config = await this.buildConfig();

      // Mettre à jour chaque planète
      const updatePromises = activePlanets.map(async (planet) => {
        try {
          const calculation = updateResources({
            resources: this.mapResources(planet),
            levels: this.mapLevels(planet),
            lastUpdate: planet.lastUpdate,
            now,
            config,
          });

          // Mettre à jour la planète en base de données
          await this.database.planet.update({
            where: { id: planet.id },
            data: {
              metal: calculation.resources.metal,
              crystal: calculation.resources.crystal,
              deuterium: calculation.resources.deuterium,
              metalProduction: calculation.productionPerHour.metal,
              crystalProduction: calculation.productionPerHour.crystal,
              deuteriumProduction: calculation.productionPerHour.deuterium,
              energyUsed: calculation.energy.used,
              energyAvailable: calculation.energy.available,
              lastUpdate: calculation.lastUpdate,
            },
          });

          // Émettre un événement WebSocket pour cette planète
          this.gameEventsGateway.emitResourcesUpdate(planet.id, {
            resources: {
              metal: calculation.resources.metal,
              crystal: calculation.resources.crystal,
              deuterium: calculation.resources.deuterium,
            },
            production: {
              metal: calculation.productionPerHour.metal,
              crystal: calculation.productionPerHour.crystal,
              deuterium: calculation.productionPerHour.deuterium,
            },
            energy: {
              used: calculation.energy.used,
              available: calculation.energy.available,
              productionLevel: calculation.energy.productionLevel,
            },
            storage: calculation.storage,
          });

          return { success: true, planetId: planet.id };
        } catch (error) {
          this.logger.error(
            `Error updating planet ${planet.id} (${planet.name}):`,
            error.message,
          );
          return { success: false, planetId: planet.id, error: error.message };
        }
      });

      // Attendre que toutes les mises à jour soient terminées
      const results = await Promise.allSettled(updatePromises);

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      ).length;
      const errorCount = results.length - successCount;

      const duration = Date.now() - startTime;
      this.logger.log(
        `Resource update completed in ${duration}ms: ${successCount} success, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error('Fatal error in resource update cron job:', error);
    }
  }

  /**
   * Cron job exécuté toutes les heures pour nettoyer les planètes inactives
   * Met à jour les ressources des planètes dont les joueurs ne se sont pas connectés depuis 7+ jours
   * (mise à jour moins fréquente pour économiser les ressources)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateInactivePlanetsResources() {
    this.logger.debug('Starting resource update for inactive planets');

    try {
      const inactivePlanets = await this.database.planet.findMany({
        where: {
          user: {
            lastActive: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Plus de 24h
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Moins de 7 jours
            },
          },
        },
        take: 100, // Limiter à 100 planètes par exécution pour éviter la surcharge
      });

      this.logger.debug(`Found ${inactivePlanets.length} inactive planets to update`);

      const now = new Date();
      const config = await this.buildConfig();

      for (const planet of inactivePlanets) {
        try {
          const calculation = updateResources({
            resources: this.mapResources(planet),
            levels: this.mapLevels(planet),
            lastUpdate: planet.lastUpdate,
            now,
            config,
          });

          await this.database.planet.update({
            where: { id: planet.id },
            data: {
              metal: calculation.resources.metal,
              crystal: calculation.resources.crystal,
              deuterium: calculation.resources.deuterium,
              metalProduction: calculation.productionPerHour.metal,
              crystalProduction: calculation.productionPerHour.crystal,
              deuteriumProduction: calculation.productionPerHour.deuterium,
              energyUsed: calculation.energy.used,
              energyAvailable: calculation.energy.available,
              lastUpdate: calculation.lastUpdate,
            },
          });
        } catch (error) {
          this.logger.error(
            `Error updating inactive planet ${planet.id}:`,
            error.message,
          );
        }
      }

      this.logger.debug('Inactive planets update completed');
    } catch (error) {
      this.logger.error('Error in inactive planets update:', error);
    }
  }

  private mapResources(planet: {
    metal: number;
    crystal: number;
    deuterium: number;
  }): ResourceState {
    return {
      metal: planet.metal,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    };
  }

  private mapLevels(planet: {
    metalMine: number;
    crystalMine: number;
    deuteriumMine: number;
    solarPlant: number;
    fusionPlant: number;
    metalStorage: number;
    crystalStorage: number;
    deuteriumStorage: number;
  }): ResourceLevels {
    return {
      metalMine: planet.metalMine,
      crystalMine: planet.crystalMine,
      deuteriumMine: planet.deuteriumMine,
      solarPlant: planet.solarPlant,
      fusionPlant: planet.fusionPlant,
      metalStorage: planet.metalStorage,
      crystalStorage: planet.crystalStorage,
      deuteriumStorage: planet.deuteriumStorage,
    };
  }

  private buildConfig(): Promise<ResourceConfig> {
    return this.serverConfig.getResourceConfig();
  }
}
