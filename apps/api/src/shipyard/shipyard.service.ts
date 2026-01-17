import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServerConfigService } from '../server-config/server-config.service';
import { BUILDINGS, SHIPS, TECHNOLOGIES, type ShipCost } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ShipyardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  async getShipyard(planetId: string, userId: string) {
    if (!planetId) {
      throw new BadRequestException('planetId requis');
    }

    const planet = await this.getPlanetOrFail(planetId, userId);

    const shipRows = await this.database.ship.findMany({
      where: { planetId },
      select: { shipId: true, amount: true },
    });

    const shipAmounts = new Map<number, number>();
    shipRows.forEach((row) => shipAmounts.set(row.shipId, row.amount));

    const techRows = await this.database.technology.findMany({
      where: { userId },
    });

    const techLevels: Record<number, number> = {};
    techRows.forEach((row) => {
      techLevels[row.techId] = row.level;
    });

    const queue = await this.database.shipQueue.findMany({
      where: { planetId, completed: false },
      orderBy: { endTime: 'asc' },
    });

    const inQueue = new Set(queue.map((entry) => entry.shipId));
    const { shipCostMultiplier } = await this.serverConfig.getConfig();

    const ships = Object.values(SHIPS).map((ship) => {
      const cost = this.applyCostMultiplier(ship.cost, shipCostMultiplier);
      const buildTime = this.getShipBuildTimeSeconds({
        cost,
        shipyardLevel: planet.shipyard,
        naniteLevel: planet.naniteFactory,
      });

      const requirements = this.checkShipRequirements(
        ship.id,
        this.extractBuildingLevels(planet),
        techLevels,
      );

      const canAfford =
        planet.metal >= cost.metal &&
        planet.crystal >= cost.crystal &&
        planet.deuterium >= cost.deuterium;

      return {
        id: ship.id,
        name: ship.name,
        description: ship.description,
        cost,
        buildTime,
        currentAmount: shipAmounts.get(ship.id) ?? 0,
        canBuild: requirements.canBuild && canAfford,
        canAfford,
        inQueue: inQueue.has(ship.id),
        missingRequirements: requirements.missingRequirements,
      };
    });

    return {
      planetId,
      ships,
      resources: {
        metal: planet.metal,
        crystal: planet.crystal,
        deuterium: planet.deuterium,
      },
    };
  }

  async startBuild(
    planetId: string,
    shipId: number,
    amount: number,
    userId: string,
  ) {
    const planet = await this.getPlanetOrFail(planetId, userId);
    const ship = SHIPS[shipId];

    if (!ship) {
      throw new BadRequestException(`Vaisseau ${shipId} inexistant`);
    }

    const safeAmount = Math.max(1, Math.floor(amount));

    const techRows = await this.database.technology.findMany({
      where: { userId },
    });
    const techLevels: Record<number, number> = {};
    techRows.forEach((row) => {
      techLevels[row.techId] = row.level;
    });

    const requirements = this.checkShipRequirements(
      shipId,
      this.extractBuildingLevels(planet),
      techLevels,
    );

    if (!requirements.canBuild) {
      throw new BadRequestException(
        `Prerequis manquants: ${requirements.missingRequirements.join(', ')}`,
      );
    }

    const { gameSpeed, shipCostMultiplier } = await this.serverConfig.getConfig();
    const unitCost = this.applyCostMultiplier(ship.cost, shipCostMultiplier);

    const totalCost = {
      metal: unitCost.metal * safeAmount,
      crystal: unitCost.crystal * safeAmount,
      deuterium: unitCost.deuterium * safeAmount,
    };

    if (
      planet.metal < totalCost.metal ||
      planet.crystal < totalCost.crystal ||
      planet.deuterium < totalCost.deuterium
    ) {
      throw new BadRequestException('Ressources insuffisantes');
    }

    const timePerUnit = this.getShipBuildTimeSeconds({
      cost: unitCost,
      shipyardLevel: planet.shipyard,
      naniteLevel: planet.naniteFactory,
    });

    const totalTimeSeconds = timePerUnit * safeAmount;
    const adjustedTime = Math.max(1, Math.floor(totalTimeSeconds / gameSpeed));

    const now = new Date();
    const lastEntry = await this.database.shipQueue.findFirst({
      where: { planetId, completed: false },
      orderBy: { endTime: 'desc' },
    });

    const startTime =
      lastEntry && lastEntry.endTime > now ? lastEntry.endTime : now;
    const endTime = new Date(startTime.getTime() + adjustedTime * 1000);

    const [updatedPlanet, queueEntry] = await this.database.$transaction([
      this.database.planet.update({
        where: { id: planetId },
        data: {
          metal: { decrement: totalCost.metal },
          crystal: { decrement: totalCost.crystal },
          deuterium: { decrement: totalCost.deuterium },
        },
      }),
      this.database.shipQueue.create({
        data: {
          planetId,
          shipId,
          amount: safeAmount,
          startTime,
          endTime,
        },
      }),
    ]);

    return {
      success: true,
      queueId: queueEntry.id,
      shipId,
      shipName: ship.name,
      amount: safeAmount,
      startTime,
      endTime,
      cost: totalCost,
      remainingResources: {
        metal: updatedPlanet.metal,
        crystal: updatedPlanet.crystal,
        deuterium: updatedPlanet.deuterium,
      },
    };
  }

  async getShipyardQueue(planetId: string, userId: string) {
    await this.getPlanetOrFail(planetId, userId);

    const queue = await this.database.shipQueue.findMany({
      where: { planetId, completed: false },
      orderBy: { startTime: 'asc' },
    });

    return queue.map((item) => ({
      id: item.id,
      shipId: item.shipId,
      shipName: SHIPS[item.shipId]?.name || `Ship ${item.shipId}`,
      amount: item.amount,
      startTime: item.startTime,
      endTime: item.endTime,
      remainingSeconds: Math.max(
        0,
        Math.floor((item.endTime.getTime() - Date.now()) / 1000),
      ),
    }));
  }

  async cancelBuild(queueId: string, userId: string) {
    const queueEntry = await this.database.shipQueue.findUnique({
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

    const ship = SHIPS[queueEntry.shipId];
    if (!ship) {
      throw new BadRequestException('Vaisseau invalide');
    }

    const { shipCostMultiplier } = await this.serverConfig.getConfig();
    const unitCost = this.applyCostMultiplier(ship.cost, shipCostMultiplier);
    const refund = {
      metal: unitCost.metal * queueEntry.amount,
      crystal: unitCost.crystal * queueEntry.amount,
      deuterium: unitCost.deuterium * queueEntry.amount,
    };

    const [updatedPlanet] = await this.database.$transaction([
      this.database.planet.update({
        where: { id: queueEntry.planetId },
        data: {
          metal: { increment: refund.metal },
          crystal: { increment: refund.crystal },
          deuterium: { increment: refund.deuterium },
        },
      }),
      this.database.shipQueue.delete({
        where: { id: queueId },
      }),
    ]);

    await this.reflowQueueTimes(queueEntry.planetId, new Date());

    return {
      success: true,
      refund,
      remainingResources: {
        metal: updatedPlanet.metal,
        crystal: updatedPlanet.crystal,
        deuterium: updatedPlanet.deuterium,
      },
    };
  }

  async completeBuild(queueEntry: {
    id: string;
    planetId: string;
    shipId: number;
    amount: number;
  }) {
    const ship = SHIPS[queueEntry.shipId];
    if (!ship) {
      console.error(`[Shipyard] Unknown ship ID: ${queueEntry.shipId}`);
      return;
    }

    await this.database.$transaction(async (tx) => {
      await tx.ship.upsert({
        where: {
          planetId_shipId: {
            planetId: queueEntry.planetId,
            shipId: queueEntry.shipId,
          },
        },
        update: { amount: { increment: queueEntry.amount } },
        create: {
          planetId: queueEntry.planetId,
          shipId: queueEntry.shipId,
          amount: queueEntry.amount,
        },
      });

      await tx.shipQueue.update({
        where: { id: queueEntry.id },
        data: { completed: true },
      });
    });
  }

  async getCompletedBuilds() {
    return this.database.shipQueue.findMany({
      where: {
        completed: false,
        endTime: { lte: new Date() },
      },
    });
  }

  private async reflowQueueTimes(planetId: string, now: Date) {
    const queue = await this.database.shipQueue.findMany({
      where: { planetId, completed: false },
      orderBy: { startTime: 'asc' },
    });

    if (queue.length <= 1) return;

    const activeEntry = queue.find(
      (entry) => entry.startTime <= now && entry.endTime > now,
    );

    let cursor = activeEntry ? activeEntry.endTime : now;

    const updates = queue
      .filter((entry) => entry.id !== activeEntry?.id)
      .filter((entry) => entry.startTime > now)
      .map((entry) => {
        const durationMs = entry.endTime.getTime() - entry.startTime.getTime();
        const startTime = cursor > now ? cursor : now;
        const endTime = new Date(startTime.getTime() + durationMs);
        cursor = endTime;

        return this.database.shipQueue.update({
          where: { id: entry.id },
          data: { startTime, endTime },
        });
      });

    if (updates.length > 0) {
      await this.database.$transaction(updates);
    }
  }

  private getShipBuildTimeSeconds(params: {
    cost: ShipCost;
    shipyardLevel: number;
    naniteLevel?: number;
  }): number {
    const { cost, shipyardLevel, naniteLevel = 0 } = params;
    const baseDivisor = 2500 * (1 + shipyardLevel) * Math.pow(2, naniteLevel);
    const buildTime = (cost.metal + cost.crystal) / baseDivisor;
    return Math.max(1, Math.floor(buildTime));
  }

  private applyCostMultiplier(cost: ShipCost, multiplier: number): ShipCost {
    const factor = multiplier > 0 ? multiplier : 1;
    return {
      metal: Math.floor(cost.metal * factor),
      crystal: Math.floor(cost.crystal * factor),
      deuterium: Math.floor(cost.deuterium * factor),
    };
  }

  private checkShipRequirements(
    shipId: number,
    planetBuildings: Record<number, number>,
    userTechnologies: Record<number, number>,
  ): { canBuild: boolean; missingRequirements: string[] } {
    const ship = SHIPS[shipId];
    if (!ship) {
      return { canBuild: false, missingRequirements: ['Vaisseau introuvable'] };
    }

    const missingRequirements: string[] = [];
    if (ship.requirements) {
      for (const [reqId, reqLevel] of Object.entries(ship.requirements)) {
        const reqIdNum = Number(reqId);
        const currentLevel =
          reqIdNum < 100
            ? planetBuildings[reqIdNum] || 0
            : userTechnologies[reqIdNum] || 0;

        if (currentLevel < reqLevel) {
          const name =
            reqIdNum < 100
              ? (BUILDINGS[reqIdNum]?.name || `Batiment ${reqIdNum}`)
              : (TECHNOLOGIES[reqIdNum]?.name || `Technologie ${reqIdNum}`);
          missingRequirements.push(
            `${name} niveau ${reqLevel} requis (actuel: ${currentLevel})`,
          );
        }
      }
    }

    return {
      canBuild: missingRequirements.length === 0,
      missingRequirements,
    };
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

}
