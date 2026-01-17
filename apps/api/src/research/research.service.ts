import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServerConfigService } from '../server-config/server-config.service';
import {
  BUILDINGS,
  TECHNOLOGIES,
  getTechnologyCost,
} from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';

@Injectable()
export class ResearchService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  async getAvailableTechnologies(planetId: string, userId: string) {
    if (!planetId) {
      throw new BadRequestException('planetId requis');
    }

    const planet = await this.getPlanetOrFail(planetId, userId);
    const techRows = await this.database.technology.findMany({
      where: { userId },
    });

    const techLevels: Record<number, number> = {};
    techRows.forEach((tech) => {
      techLevels[tech.techId] = tech.level;
    });

    const queue = await this.database.researchQueue.findMany({
      where: { userId, completed: false },
      orderBy: { endTime: 'asc' },
    });

    const queueBlocked = queue.length > 0;
    const { maxTechnologyLevel, researchCostMultiplier } =
      await this.serverConfig.getConfig();

    const technologies = Object.values(TECHNOLOGIES).map((tech) => {
      const currentLevel = techLevels[tech.id] || 0;
      const rawCost = getTechnologyCost(tech.id, currentLevel);
      const cost = this.applyCostMultiplier(rawCost, researchCostMultiplier);
      const buildTime = this.getResearchTimeSeconds({
        cost,
        labLevel: planet.researchLab,
      });
      const requirements = this.checkTechRequirements(
        tech.id,
        this.extractBuildingLevels(planet),
        techLevels,
      );

      const canAfford =
        planet.metal >= cost.metal &&
        planet.crystal >= cost.crystal &&
        planet.deuterium >= cost.deuterium;

      const inQueue = queue.find((q) => q.techId === tech.id);
      const isMaxLevel = currentLevel >= maxTechnologyLevel;

      return {
        id: tech.id,
        name: tech.name,
        description: tech.description,
        category: tech.category,
        currentLevel,
        maxLevel: maxTechnologyLevel,
        isMaxLevel,
        cost,
        buildTime,
        canResearch:
          requirements.canResearch && canAfford && !inQueue && !queueBlocked && !isMaxLevel,
        canAfford,
        inQueue: !!inQueue,
        queueEndTime: inQueue?.endTime,
        missingRequirements: requirements.missingRequirements,
        queueBlocked,
      };
    });

    return {
      planetId,
      technologies,
      resources: {
        metal: planet.metal,
        crystal: planet.crystal,
        deuterium: planet.deuterium,
      },
    };
  }

  async startResearch(planetId: string, techId: number, userId: string) {
    const planet = await this.getPlanetOrFail(planetId, userId);
    const tech = TECHNOLOGIES[techId];
    if (!tech) {
      throw new BadRequestException(`Technologie ${techId} inexistante`);
    }

    const activeQueue = await this.database.researchQueue.findFirst({
      where: { userId, completed: false },
    });

    if (activeQueue) {
      throw new BadRequestException('Une recherche est deja en cours');
    }

    const techRows = await this.database.technology.findMany({
      where: { userId },
    });
    const techLevels: Record<number, number> = {};
    techRows.forEach((row) => {
      techLevels[row.techId] = row.level;
    });

    const currentLevel = techLevels[techId] || 0;
    const { gameSpeed, maxTechnologyLevel, researchCostMultiplier } =
      await this.serverConfig.getConfig();

    if (currentLevel >= maxTechnologyLevel) {
      throw new BadRequestException('Niveau max atteint');
    }

    const requirements = this.checkTechRequirements(
      techId,
      this.extractBuildingLevels(planet),
      techLevels,
    );

    if (!requirements.canResearch) {
      throw new BadRequestException(
        `Prerequis manquants: ${requirements.missingRequirements.join(', ')}`,
      );
    }

    const rawCost = getTechnologyCost(techId, currentLevel);
    const cost = this.applyCostMultiplier(rawCost, researchCostMultiplier);
    if (
      planet.metal < cost.metal ||
      planet.crystal < cost.crystal ||
      planet.deuterium < cost.deuterium
    ) {
      throw new BadRequestException('Ressources insuffisantes');
    }

    const buildTimeSeconds = this.getResearchTimeSeconds({
      cost,
      labLevel: planet.researchLab,
    });
    const adjustedTime = Math.max(1, Math.floor(buildTimeSeconds / gameSpeed));

    const now = new Date();
    const endTime = new Date(now.getTime() + adjustedTime * 1000);

    const [updatedPlanet, queueEntry] = await this.database.$transaction([
      this.database.planet.update({
        where: { id: planetId },
        data: {
          metal: { decrement: cost.metal },
          crystal: { decrement: cost.crystal },
          deuterium: { decrement: cost.deuterium },
        },
      }),
      this.database.researchQueue.create({
        data: {
          userId,
          planetId,
          techId,
          level: currentLevel + 1,
          startTime: now,
          endTime,
        },
      }),
    ]);

    return {
      success: true,
      queueId: queueEntry.id,
      techId,
      techName: tech.name,
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

  async getResearchQueue(userId: string) {
    const queue = await this.database.researchQueue.findMany({
      where: { userId, completed: false },
      orderBy: { endTime: 'asc' },
    });

    return queue.map((item) => ({
      id: item.id,
      techId: item.techId,
      techName: TECHNOLOGIES[item.techId]?.name || `Tech ${item.techId}`,
      targetLevel: item.level,
      startTime: item.startTime,
      endTime: item.endTime,
      remainingSeconds: Math.max(
        0,
        Math.floor((item.endTime.getTime() - Date.now()) / 1000),
      ),
    }));
  }

  async cancelResearch(queueId: string, userId: string) {
    const queueEntry = await this.database.researchQueue.findUnique({
      where: { id: queueId },
    });

    if (!queueEntry) {
      throw new NotFoundException('Recherche introuvable');
    }

    if (queueEntry.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    if (queueEntry.completed) {
      throw new BadRequestException('Recherche deja terminee');
    }

    const cost = getTechnologyCost(queueEntry.techId, queueEntry.level - 1);

    const [updatedPlanet] = await this.database.$transaction([
      this.database.planet.update({
        where: { id: queueEntry.planetId },
        data: {
          metal: { increment: cost.metal },
          crystal: { increment: cost.crystal },
          deuterium: { increment: cost.deuterium },
        },
      }),
      this.database.researchQueue.delete({
        where: { id: queueId },
      }),
    ]);

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

  async completeResearch(queueEntry: {
    id: string;
    userId: string;
    techId: number;
    level: number;
  }) {
    const tech = TECHNOLOGIES[queueEntry.techId];
    if (!tech) {
      console.error(`[Research] Unknown tech ID: ${queueEntry.techId}`);
      return;
    }

    const existing = await this.database.technology.findUnique({
      where: { userId_techId: { userId: queueEntry.userId, techId: queueEntry.techId } },
    });

    await this.database.$transaction(async (tx) => {
      if (existing) {
        await tx.technology.update({
          where: { id: existing.id },
          data: { level: queueEntry.level },
        });
      } else {
        await tx.technology.create({
          data: {
            userId: queueEntry.userId,
            techId: queueEntry.techId,
            level: queueEntry.level,
          },
        });
      }

      await tx.researchQueue.update({
        where: { id: queueEntry.id },
        data: { completed: true },
      });
    });

    this.gameEvents.emitResearchCompleted(queueEntry.userId, {
      techId: queueEntry.techId,
      techName: tech.name,
      newLevel: queueEntry.level,
    });
  }

  async getCompletedResearch() {
    return this.database.researchQueue.findMany({
      where: {
        completed: false,
        endTime: { lte: new Date() },
      },
    });
  }

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

  private checkTechRequirements(
    techId: number,
    buildingLevels: Record<number, number>,
    techLevels: Record<number, number>,
  ) {
    const tech = TECHNOLOGIES[techId];
    if (!tech?.requirements) {
      return { canResearch: true, missingRequirements: [] as string[] };
    }

    const missing: string[] = [];
    Object.entries(tech.requirements).forEach(([reqIdRaw, level]) => {
      const reqId = Number(reqIdRaw);
      if (BUILDINGS[reqId]) {
        const current = buildingLevels[reqId] || 0;
        if (current < level) {
          missing.push(`${BUILDINGS[reqId].name} ${current}/${level}`);
        }
      } else if (TECHNOLOGIES[reqId]) {
        const current = techLevels[reqId] || 0;
        if (current < level) {
          missing.push(`${TECHNOLOGIES[reqId].name} ${current}/${level}`);
        }
      }
    });

    return {
      canResearch: missing.length === 0,
      missingRequirements: missing,
    };
  }

  private applyCostMultiplier(
    cost: { metal: number; crystal: number; deuterium: number; energy?: number },
    multiplier: number,
  ) {
    const factor = multiplier > 0 ? multiplier : 1;
    return {
      metal: Math.floor(cost.metal * factor),
      crystal: Math.floor(cost.crystal * factor),
      deuterium: Math.floor(cost.deuterium * factor),
      energy: cost.energy ? Math.floor(cost.energy * factor) : undefined,
    };
  }

  private getResearchTimeSeconds(params: {
    cost: { metal: number; crystal: number };
    labLevel: number;
  }) {
    const base = params.cost.metal + params.cost.crystal;
    const divisor = 1000 * (1 + params.labLevel);
    return Math.max(1, Math.floor(base / divisor));
  }

}
