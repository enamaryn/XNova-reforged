import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  floorResources,
  updateResources,
  type ResourceConfig,
  type ResourceLevels,
  type ResourceState,
} from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';
import { persistResourceRefresh } from './resource-refresh';
import { ServerConfigService } from '../server-config/server-config.service';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  async getPlanet(planetId: string, userId: string) {
    const { planet, calculation } = await this.refreshPlanet(planetId, userId);

    return {
      ...planet,
      ...floorResources(this.mapResources(planet)),
      storage: calculation.storage,
      productionLevel: calculation.energy.productionLevel,
    };
  }

  /**
   * Retourne un snapshot des ressources et de l'energie d'une planete.
   *
   * @param planetId - ID de la planete.
   * @param userId - ID du proprietaire.
   * @returns Etat des ressources, production, energie et stockage.
   */
  async getPlanetResources(planetId: string, userId: string) {
    const { planet, calculation } = await this.refreshPlanet(planetId, userId);

    return {
      planetId: planet.id,
      resources: floorResources(this.mapResources(planet)),
      production: {
        metal: planet.metalProduction,
        crystal: planet.crystalProduction,
        deuterium: planet.deuteriumProduction,
      },
      energy: {
        used: planet.energyUsed,
        available: planet.energyAvailable,
        productionLevel: calculation.energy.productionLevel,
      },
      storage: calculation.storage,
      lastUpdate: planet.lastUpdate,
    };
  }

  async renamePlanet(planetId: string, userId: string, name: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: planetId },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    const updated = await this.database.planet.update({
      where: { id: planetId },
      data: { name },
      select: {
        id: true,
        name: true,
        galaxy: true,
        system: true,
        position: true,
      },
    });

    return updated;
  }

  /**
   * Rafraichit l'etat d'une planete et met a jour ses ressources.
   *
   * Etapes:
   * - Verifie l'acces utilisateur.
   * - Recalcule la production via updateResources.
   * - Persiste les nouveaux soldes et timestamps.
   *
   * @param planetId - ID de la planete.
   * @param userId - ID du proprietaire.
   * @returns Planete mise a jour et calculs associes.
   */
  private async refreshPlanet(planetId: string, userId: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: planetId },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    const calculation = updateResources({
      resources: this.mapResources(planet),
      levels: this.mapLevels(planet),
      lastUpdate: planet.lastUpdate,
      now: new Date(),
      config: await this.buildConfig(),
    });

    // Delta + verrou optimiste sur lastUpdate (ECO-02). Si un autre rafraichissement
    // (API ou cron) a devance celui-ci, sa production est deja en base : on relit sans rien ecrire.
    await persistResourceRefresh(this.database, planet, calculation);

    const updatedPlanet = await this.database.planet.findUnique({
      where: { id: planet.id },
    });

    return {
      planet: updatedPlanet ?? planet,
      calculation,
    };
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
