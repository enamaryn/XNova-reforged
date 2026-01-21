import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServerConfigService } from '../server-config/server-config.service';
import {
  BUILDINGS,
  getBuildingCost,
  getBuildingTime,
  checkBuildingRequirements,
  type BuildingCost,
} from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';

// Mapping des buildingId vers les champs de la table Planet
const BUILDING_FIELD_MAP: Record<number, string> = {
  1: 'metalMine',
  2: 'crystalMine',
  3: 'deuteriumMine',
  4: 'solarPlant',
  12: 'fusionPlant',
  14: 'roboticsFactory',
  15: 'naniteFactory',
  21: 'shipyard',
  22: 'metalStorage',
  23: 'crystalStorage',
  24: 'deuteriumStorage',
  31: 'researchLab',
  33: 'terraformer',
  34: 'allianceDepot',
  44: 'missileSilo',
  41: 'moonBase',
  42: 'phalanx',
  43: 'jumpGate',
};

@Injectable()
export class BuildingsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  /**
   * Recupere la liste de tous les batiments disponibles pour une planete.
   *
   * Calcule:
   * - Cout et duree selon le niveau actuel.
   * - Prerequis technos/batiments.
   * - Disponibilite selon ressources et file active.
   */
  async getAvailableBuildings(planetId: string, userId: string) {
    const planet = await this.getPlanetOrFail(planetId, userId);
    const planetBuildings = this.extractBuildingLevels(planet);

    // Recuperer les technologies de l'utilisateur
    const userTechs = await this.database.technology.findMany({
      where: { userId },
    });
    const techLevels: Record<string, number> = {};
    userTechs.forEach((t) => {
      techLevels[t.techId] = t.level;
    });

    // File d'attente actuelle
    const queue = await this.database.buildQueue.findMany({
      where: { planetId, completed: false },
      orderBy: { endTime: 'asc' },
    });

    const { maxBuildingLevel, buildingCostMultiplier } =
      await this.serverConfig.getConfig();
    const costFactor = buildingCostMultiplier > 0 ? buildingCostMultiplier : 1;

    const buildingsInfo = Object.values(BUILDINGS).map((building) => {
      const currentLevel = planetBuildings[building.id] || 0;
      const rawCost = getBuildingCost(building.id, currentLevel);
      const cost = this.applyCostMultiplier(rawCost, costFactor);
      const baseTime = getBuildingTime({
        buildingId: building.id,
        currentLevel,
        roboticsLevel: planet.roboticsFactory,
        naniteLevel: planet.naniteFactory,
      });
      const time = Math.max(1, Math.floor(baseTime * costFactor));

      // Verifier les prerequis
      const requirements = checkBuildingRequirements(
        building.id,
        planetBuildings,
        techLevels,
      );

      // Verifier si assez de ressources
      const canAfford =
        planet.metal >= cost.metal &&
        planet.crystal >= cost.crystal &&
        planet.deuterium >= cost.deuterium;

      // Verifier si deja en construction
      const inQueue = queue.find((q) => q.buildingId === building.id);
      const isMaxLevel = currentLevel >= maxBuildingLevel;

      return {
        id: building.id,
        name: building.name,
        description: building.description,
        category: building.category,
        currentLevel,
        maxLevel: maxBuildingLevel,
        isMaxLevel,
        cost,
        buildTime: time, // en secondes
        canBuild: requirements.canBuild && canAfford && !inQueue && !isMaxLevel,
        canAfford,
        inQueue: !!inQueue,
        queueEndTime: inQueue?.endTime,
        missingRequirements: requirements.missingRequirements,
      };
    });

    return {
      planetId,
      buildings: buildingsInfo,
      resources: {
        metal: planet.metal,
        crystal: planet.crystal,
        deuterium: planet.deuterium,
      },
    };
  }

  /**
   * Demarre la construction d'un batiment en file.
   *
   * Verifie:
   * - Preconditions (prerequis, ressources, champs).
   * - Absence de construction parallele pour ce batiment.
   * - Niveau max serveur.
   */
  async startConstruction(planetId: string, buildingId: number, userId: string) {
    const planet = await this.getPlanetOrFail(planetId, userId);

    // Verifier que le batiment existe
    const building = BUILDINGS[buildingId];
    if (!building) {
      throw new BadRequestException(`Batiment ${buildingId} inexistant`);
    }

    // Verifier qu'il n'y a pas deja une construction en cours pour ce batiment
    const existingQueue = await this.database.buildQueue.findFirst({
      where: { planetId, buildingId, completed: false },
    });
    if (existingQueue) {
      throw new BadRequestException(
        `${building.name} est deja en cours de construction`,
      );
    }

    // Recuperer le niveau actuel
    const planetBuildings = this.extractBuildingLevels(planet);
    const currentLevel = planetBuildings[buildingId] || 0;
    const { gameSpeed, maxBuildingLevel, buildingCostMultiplier } =
      await this.serverConfig.getConfig();
    const costFactor = buildingCostMultiplier > 0 ? buildingCostMultiplier : 1;

    if (currentLevel >= maxBuildingLevel) {
      throw new BadRequestException('Niveau max atteint');
    }

    // Verifier les prerequis
    const userTechs = await this.database.technology.findMany({
      where: { userId },
    });
    const techLevels: Record<string, number> = {};
    userTechs.forEach((t) => {
      techLevels[t.techId] = t.level;
    });

    const requirements = checkBuildingRequirements(
      buildingId,
      planetBuildings,
      techLevels,
    );
    if (!requirements.canBuild) {
      throw new BadRequestException(
        `Prerequis manquants: ${requirements.missingRequirements.join(', ')}`,
      );
    }

    // Calculer le cout
    const rawCost = getBuildingCost(buildingId, currentLevel);
    const cost = this.applyCostMultiplier(rawCost, costFactor);

    // Verifier les ressources
    if (
      planet.metal < cost.metal ||
      planet.crystal < cost.crystal ||
      planet.deuterium < cost.deuterium
    ) {
      throw new BadRequestException('Ressources insuffisantes');
    }

    // Verifier les champs disponibles (sauf pour certains batiments)
    const fieldsExempt = [22, 23, 24]; // Hangars de stockage ne prennent pas de champs
    if (!fieldsExempt.includes(buildingId)) {
      if (planet.fieldsUsed >= planet.fieldsMax) {
        throw new BadRequestException('Plus de champs disponibles');
      }
    }

    // Calculer la duree de construction
    const baseBuildTimeSeconds = getBuildingTime({
      buildingId,
      currentLevel,
      roboticsLevel: planet.roboticsFactory,
      naniteLevel: planet.naniteFactory,
    });
    const buildTimeSeconds = Math.max(1, Math.floor(baseBuildTimeSeconds * costFactor));

    const adjustedTime = Math.max(1, Math.floor(buildTimeSeconds / gameSpeed));

    const now = new Date();
    const endTime = new Date(now.getTime() + adjustedTime * 1000);

    // Deduire les ressources et creer la file d'attente
    const [updatedPlanet, queueEntry] = await this.database.$transaction([
      this.database.planet.update({
        where: { id: planetId },
        data: {
          metal: { decrement: cost.metal },
          crystal: { decrement: cost.crystal },
          deuterium: { decrement: cost.deuterium },
        },
      }),
      this.database.buildQueue.create({
        data: {
          planetId,
          buildingId,
          level: currentLevel + 1,
          startTime: now,
          endTime,
        },
      }),
    ]);

    // Emettre un evenement WebSocket
    this.gameEvents.emitToPlanet(planetId, 'building:started', {
      queueId: queueEntry.id,
      buildingId,
      buildingName: building.name,
      targetLevel: currentLevel + 1,
      startTime: now,
      endTime,
    });

    return {
      success: true,
      queueId: queueEntry.id,
      buildingId,
      buildingName: building.name,
      targetLevel: currentLevel + 1,
      startTime: now,
      endTime,
      cost,
      remainingResources: {
        metal: updatedPlanet.metal,
        crystal: updatedPlanet.crystal,
        deuterium: updatedPlanet.deuterium,
      },
    };
  }

  /**
   * Recupere la file d'attente de construction d'une planete
   */
  async getBuildQueue(planetId: string, userId: string) {
    await this.getPlanetOrFail(planetId, userId);

    const queue = await this.database.buildQueue.findMany({
      where: { planetId, completed: false },
      orderBy: { endTime: 'asc' },
    });

    return queue.map((item) => ({
      id: item.id,
      buildingId: item.buildingId,
      buildingName: BUILDINGS[item.buildingId]?.name || `Building ${item.buildingId}`,
      targetLevel: item.level,
      startTime: item.startTime,
      endTime: item.endTime,
      remainingSeconds: Math.max(
        0,
        Math.floor((item.endTime.getTime() - Date.now()) / 1000),
      ),
    }));
  }

  /**
   * Annule une construction en cours et rembourse 100% des ressources
   */
  async cancelConstruction(queueId: string, userId: string) {
    const queueEntry = await this.database.buildQueue.findUnique({
      where: { id: queueId },
      include: { planet: true },
    });

    if (!queueEntry) {
      throw new NotFoundException('Construction introuvable');
    }

    if (queueEntry.planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    if (queueEntry.completed) {
      throw new BadRequestException('Construction deja terminee');
    }

    const building = BUILDINGS[queueEntry.buildingId];
    const cost = getBuildingCost(queueEntry.buildingId, queueEntry.level - 1);

    // Rembourser 100% et supprimer de la file
    const [updatedPlanet] = await this.database.$transaction([
      this.database.planet.update({
        where: { id: queueEntry.planetId },
        data: {
          metal: { increment: cost.metal },
          crystal: { increment: cost.crystal },
          deuterium: { increment: cost.deuterium },
        },
      }),
      this.database.buildQueue.delete({
        where: { id: queueId },
      }),
    ]);

    // Emettre un evenement WebSocket
    this.gameEvents.emitToPlanet(queueEntry.planetId, 'building:cancelled', {
      queueId,
      buildingId: queueEntry.buildingId,
      buildingName: building?.name,
      refund: cost,
    });

    return {
      success: true,
      refund: cost,
      remainingResources: {
        metal: updatedPlanet.metal,
        crystal: updatedPlanet.crystal,
        deuterium: updatedPlanet.deuterium,
      },
    };
  }

  /**
   * Finalise une construction terminee (appele par le cron job)
   */
  async completeConstruction(queueEntry: {
    id: string;
    planetId: string;
    buildingId: number;
    level: number;
  }) {
    const fieldName = BUILDING_FIELD_MAP[queueEntry.buildingId];
    if (!fieldName) {
      console.error(
        `[Buildings] Unknown building ID: ${queueEntry.buildingId}`,
      );
      return;
    }

    const building = BUILDINGS[queueEntry.buildingId];

    // Incrementer le niveau du batiment
    const updateData: Record<string, unknown> = {
      [fieldName]: queueEntry.level,
    };

    // Si ce n'est pas un hangar de stockage, incrementer fieldsUsed
    const fieldsExempt = [22, 23, 24];
    if (!fieldsExempt.includes(queueEntry.buildingId)) {
      updateData.fieldsUsed = { increment: 1 };
    }

    await this.database.$transaction([
      this.database.planet.update({
        where: { id: queueEntry.planetId },
        data: updateData,
      }),
      this.database.buildQueue.update({
        where: { id: queueEntry.id },
        data: { completed: true },
      }),
    ]);

    // Emettre un evenement WebSocket
    this.gameEvents.emitToPlanet(queueEntry.planetId, 'building:completed', {
      buildingId: queueEntry.buildingId,
      buildingName: building?.name,
      newLevel: queueEntry.level,
    });

    console.log(
      `[Buildings] Completed: ${building?.name} level ${queueEntry.level} on planet ${queueEntry.planetId}`,
    );
  }

  /**
   * Recupere les constructions terminees (pour le cron)
   */
  async getCompletedConstructions() {
    return this.database.buildQueue.findMany({
      where: {
        completed: false,
        endTime: { lte: new Date() },
      },
    });
  }

  // ============ HELPERS ============

  private async getPlanetOrFail(planetId: string, userId: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: planetId },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    return planet;
  }

  private extractBuildingLevels(planet: {
    metalMine: number;
    crystalMine: number;
    deuteriumMine: number;
    solarPlant: number;
    fusionPlant: number;
    roboticsFactory: number;
    naniteFactory: number;
    shipyard: number;
    metalStorage: number;
    crystalStorage: number;
    deuteriumStorage: number;
    researchLab: number;
    terraformer: number;
    allianceDepot: number;
    missileSilo: number;
    moonBase: number;
    phalanx: number;
    jumpGate: number;
  }): Record<number, number> {
    return {
      1: planet.metalMine,
      2: planet.crystalMine,
      3: planet.deuteriumMine,
      4: planet.solarPlant,
      12: planet.fusionPlant,
      14: planet.roboticsFactory,
      15: planet.naniteFactory,
      21: planet.shipyard,
      22: planet.metalStorage,
      23: planet.crystalStorage,
      24: planet.deuteriumStorage,
      31: planet.researchLab,
      33: planet.terraformer,
      34: planet.allianceDepot,
      44: planet.missileSilo,
      41: planet.moonBase,
      42: planet.phalanx,
      43: planet.jumpGate,
    };
  }

  /**
   * Applique un multiplicateur global sur le cout brut d'un batiment.
   *
   * Formule:
   * coutFinal = coutBase * multiplier
   *
   * @param cost - Cout brut calcule depuis les configs.
   * @param multiplier - Facteur de serveur (>= 1).
   * @returns Cout ajuste et arrondi.
   */
  private applyCostMultiplier(
    cost: BuildingCost,
    multiplier: number,
  ): BuildingCost {
    const factor = multiplier > 0 ? multiplier : 1;
    return {
      metal: Math.floor(cost.metal * factor),
      crystal: Math.floor(cost.crystal * factor),
      deuterium: Math.floor(cost.deuterium * factor),
      energy: cost.energy ? Math.floor(cost.energy * factor) : 0,
    };
  }

}
