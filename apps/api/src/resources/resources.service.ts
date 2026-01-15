import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  updateResources,
  type ResourceConfig,
  type ResourceLevels,
  type ResourceState,
} from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getPlanet(planetId: string, userId: string) {
    const { planet, calculation } = await this.refreshPlanet(planetId, userId);

    return {
      ...planet,
      storage: calculation.storage,
      productionLevel: calculation.energy.productionLevel,
    };
  }

  async getPlanetResources(planetId: string, userId: string) {
    const { planet, calculation } = await this.refreshPlanet(planetId, userId);

    return {
      planetId: planet.id,
      resources: {
        metal: planet.metal,
        crystal: planet.crystal,
        deuterium: planet.deuterium,
      },
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
      config: this.buildConfig(),
    });

    const updatedPlanet = await this.database.planet.update({
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

    return {
      planet: updatedPlanet,
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

  private buildConfig(): ResourceConfig {
    return {
      baseIncome: {
        metal: 20,
        crystal: 10,
        deuterium: 0,
      },
      resourceMultiplier: this.getNumber('RESOURCE_MULTIPLIER', 1),
      gameSpeed: this.getNumber('GAME_SPEED', 1),
      storageBase: 1_000_000,
      storageFactor: 1.5,
      storageOverflow: 1.1,
    };
  }

  private getNumber(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);
    if (!rawValue) return fallback;
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
}
