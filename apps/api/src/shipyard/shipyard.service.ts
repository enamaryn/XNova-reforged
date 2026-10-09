import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ProgressionService } from "../progression/progression.service";
import { ServerConfigService } from "../server-config/server-config.service";
import {
  scheduleProduction,
  BUILDINGS,
  DEFENSES,
  IMPLEMENTED_DEFENSES,
  SHIPS,
  SINGLE_UNIT_DEFENSES,
  TECHNOLOGIES,
  type ShipCost,
} from "@xnova/game-config";
import { DatabaseService } from "../database/database.service";
import { debitResources, lockPlanet } from "../common/atomic";

@Injectable()
export class ShipyardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly progression: ProgressionService,
  ) {}

  async getShipyard(planetId: string, userId: string) {
    if (!planetId) {
      throw new BadRequestException("planetId requis");
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
      orderBy: { endTime: "asc" },
    });

    const inQueue = new Set(queue.map((entry) => entry.shipId));
    const { shipCostMultiplier, gameSpeed } =
      await this.serverConfig.getConfig();

    const ships = Object.values(SHIPS).map((ship) => {
      const cost = this.applyCostMultiplier(ship.cost, shipCostMultiplier);
      const buildTime = Math.max(
        1,
        Math.floor(
          this.getShipBuildTimeSeconds({
            cost,
            shipyardLevel: planet.shipyard,
            naniteLevel: planet.naniteFactory,
          }) / gameSpeed,
        ),
      );

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
      progression: await this.progression.get(userId),
      resources: {
        metal: planet.metal,
        crystal: planet.crystal,
        deuterium: planet.deuterium,
      },
    };
  }

  async getDefenses(planetId: string, userId: string) {
    if (!planetId) {
      throw new BadRequestException("planetId requis");
    }

    const planet = await this.getPlanetOrFail(planetId, userId);

    const rows = await this.database.defense.findMany({
      where: { planetId },
      select: { defenseId: true, amount: true },
    });
    const amounts = new Map(rows.map((row) => [row.defenseId, row.amount]));

    const techRows = await this.database.technology.findMany({
      where: { userId },
    });
    const techLevels: Record<number, number> = {};
    techRows.forEach((row) => {
      techLevels[row.techId] = row.level;
    });

    const queue = await this.database.shipQueue.findMany({
      where: {
        planetId,
        completed: false,
        shipId: { in: [...IMPLEMENTED_DEFENSES] },
      },
    });
    const queued = new Map<number, number>();
    queue.forEach((entry) =>
      queued.set(entry.shipId, (queued.get(entry.shipId) ?? 0) + entry.amount),
    );

    const { shipCostMultiplier, gameSpeed } =
      await this.serverConfig.getConfig();

    const defenses = IMPLEMENTED_DEFENSES.map((id) => {
      const defense = DEFENSES[id];
      const cost = this.applyCostMultiplier(defense.cost, shipCostMultiplier);
      const buildTime = Math.max(
        1,
        Math.floor(
          this.getShipBuildTimeSeconds({
            cost,
            shipyardLevel: planet.shipyard,
            naniteLevel: planet.naniteFactory,
          }) / gameSpeed,
        ),
      );
      const requirements = this.checkRequirements(
        id,
        this.extractBuildingLevels(planet),
        techLevels,
      );
      const canAfford =
        planet.metal >= cost.metal &&
        planet.crystal >= cost.crystal &&
        planet.deuterium >= cost.deuterium;
      const currentAmount = amounts.get(id) ?? 0;
      const inQueue = queued.get(id) ?? 0;
      const single = SINGLE_UNIT_DEFENSES.includes(id);
      const missingRequirements = [...requirements.missingRequirements];
      if (single && currentAmount + inQueue >= 1) {
        missingRequirements.push("Une seule unité par planète");
      }

      return {
        id,
        name: defense.name,
        description: defense.description,
        cost,
        buildTime,
        stats: defense.stats,
        currentAmount,
        inQueue,
        singleUnit: single,
        canAfford,
        canBuild: missingRequirements.length === 0 && canAfford,
        missingRequirements,
      };
    });

    return {
      planetId,
      defenses,
      progression: await this.progression.get(userId),
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
    kind: "ship" | "defense" = "ship",
  ) {
    const planet = await this.getPlanetOrFail(planetId, userId);
    const isDefense = kind === "defense";
    const ship = isDefense
      ? IMPLEMENTED_DEFENSES.includes(shipId)
        ? DEFENSES[shipId]
        : undefined
      : SHIPS[shipId];

    if (!ship) {
      throw new BadRequestException(
        isDefense
          ? `Defense ${shipId} inexistante ou indisponible`
          : `Vaisseau ${shipId} inexistant`,
      );
    }

    const safeAmount = Math.max(1, Math.floor(amount));

    const techRows = await this.database.technology.findMany({
      where: { userId },
    });
    const techLevels: Record<number, number> = {};
    techRows.forEach((row) => {
      techLevels[row.techId] = row.level;
    });

    const requirements = this.checkRequirements(
      shipId,
      this.extractBuildingLevels(planet),
      techLevels,
    );

    if (
      isDefense &&
      SINGLE_UNIT_DEFENSES.includes(shipId) &&
      safeAmount !== 1
    ) {
      throw new BadRequestException(
        "Un bouclier planetaire ne se construit qu'en un seul exemplaire",
      );
    }

    if (!requirements.canBuild) {
      throw new BadRequestException(
        `Prerequis manquants: ${requirements.missingRequirements.join(", ")}`,
      );
    }

    const { gameSpeed, shipCostMultiplier } =
      await this.serverConfig.getConfig();
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
      throw new BadRequestException("Ressources insuffisantes");
    }

    const timePerUnit = this.getShipBuildTimeSeconds({
      cost: unitCost,
      shipyardLevel: planet.shipyard,
      naniteLevel: planet.naniteFactory,
    });

    const totalTimeSeconds = timePerUnit * safeAmount;
    const adjustedTime = Math.max(1, Math.floor(totalTimeSeconds / gameSpeed));

    const now = new Date();

    // Debit conditionnel et calcul de la file dans une transaction verrouillee sur la planete (ECO-03)
    const { updatedPlanet, queueEntry, startTime, endTime } =
      await this.database.$transaction(async (tx) => {
        await lockPlanet(tx, planetId);

        if (isDefense && SINGLE_UNIT_DEFENSES.includes(shipId)) {
          const built = await tx.defense.findUnique({
            where: { planetId_defenseId: { planetId, defenseId: shipId } },
          });
          const pending = await tx.shipQueue.count({
            where: { planetId, shipId, completed: false },
          });
          if ((built?.amount ?? 0) + pending >= 1) {
            throw new BadRequestException(
              "Ce bouclier existe deja sur cette planete",
            );
          }
        }

        // Insert as waiting; scheduler assigns a free lane and serializes identical types.
        const startTime = new Date(now.getTime() + 1);
        const endTime = new Date(startTime.getTime() + adjustedTime * 1000);

        await debitResources(tx, planetId, totalCost);

        const queueEntry = await tx.shipQueue.create({
          data: {
            planetId,
            shipId,
            amount: safeAmount,
            startTime,
            endTime,
            paidCost: {
              metal: totalCost.metal,
              crystal: totalCost.crystal,
              deuterium: totalCost.deuterium,
            },
          },
        });
        const updatedPlanet = await tx.planet.findUniqueOrThrow({
          where: { id: planetId },
        });
        await this.reflowQueueTimes(tx, planetId, userId, now);
        const scheduled = await tx.shipQueue.findUniqueOrThrow({
          where: { id: queueEntry.id },
        });
        return {
          updatedPlanet,
          queueEntry: scheduled,
          startTime: scheduled.startTime,
          endTime: scheduled.endTime,
        };
      });

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

    await this.database.$transaction(async (tx) => {
      await lockPlanet(tx, planetId);
      await this.reflowQueueTimes(tx, planetId, userId, new Date());
    });
    const queue = await this.database.shipQueue.findMany({
      where: { planetId, completed: false },
      orderBy: { startTime: "asc" },
    });

    return queue.map((item) => ({
      id: item.id,
      shipId: item.shipId,
      shipName:
        SHIPS[item.shipId]?.name ||
        DEFENSES[item.shipId]?.name ||
        `Ship ${item.shipId}`,
      kind: item.shipId >= 400 ? "defense" : "ship",
      amount: item.amount,
      status: item.startTime.getTime() > Date.now() ? "waiting" : "active",
      canCancel: item.startTime.getTime() > Date.now(),
      refund: this.refundFor(item),
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
      throw new NotFoundException("Construction introuvable");
    }

    if (queueEntry.planet.userId !== userId) {
      throw new ForbiddenException("Acces refuse");
    }

    if (queueEntry.completed) {
      throw new BadRequestException("Construction deja terminee");
    }

    const ship = SHIPS[queueEntry.shipId] ?? DEFENSES[queueEntry.shipId];
    if (!ship) {
      throw new BadRequestException("Vaisseau invalide");
    }

    const { updatedPlanet, refund } = await this.database.$transaction(
      async (tx) => {
        await lockPlanet(tx, queueEntry.planetId);
        const current = await tx.shipQueue.findUnique({
          where: { id: queueId },
        });
        if (!current || current.completed)
          throw new BadRequestException("Commande déjà terminée ou annulée");
        if (current.startTime <= new Date())
          throw new BadRequestException(
            "La production a déjà démarré ; seules les commandes en attente peuvent être retirées.",
          );
        const refund = this.refundFor(current);
        await tx.shipQueue.delete({ where: { id: queueId } });
        const updatedPlanet = await tx.planet.update({
          where: { id: current.planetId },
          data: {
            metal: { increment: refund.metal },
            crystal: { increment: refund.crystal },
            deuterium: { increment: refund.deuterium },
          },
        });
        await this.reflowQueueTimes(tx, current.planetId, userId, new Date());
        return { updatedPlanet, refund };
      },
    );

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
    const defense = DEFENSES[queueEntry.shipId];
    const ship = SHIPS[queueEntry.shipId];
    if (!ship && !defense) {
      console.error(`[Shipyard] Unknown ship ID: ${queueEntry.shipId}`);
      return;
    }

    await this.database.$transaction(async (tx) => {
      await lockPlanet(tx, queueEntry.planetId);
      const current = await tx.shipQueue.findUnique({
        where: { id: queueEntry.id },
      });
      if (!current || current.completed || current.endTime > new Date()) return;
      // Use the database lot, never stale caller quantities.
      queueEntry = current;
      // Prise en charge atomique : ignore une commande deja annulee ou terminee
      const claimed = await tx.shipQueue.updateMany({
        where: { id: queueEntry.id, completed: false },
        data: { completed: true },
      });
      if (claimed.count !== 1) return;

      if (defense && !ship) {
        await tx.defense.upsert({
          where: {
            planetId_defenseId: {
              planetId: queueEntry.planetId,
              defenseId: queueEntry.shipId,
            },
          },
          update: { amount: { increment: queueEntry.amount } },
          create: {
            planetId: queueEntry.planetId,
            defenseId: queueEntry.shipId,
            amount: queueEntry.amount,
          },
        });
        return;
      }

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
    });
  }

  async getCompletedBuilds() {
    const planets = await this.database.planet.findMany({
      where: { shipQueue: { some: { completed: false } } },
      select: { id: true, userId: true },
    });
    for (const planet of planets)
      await this.database.$transaction(async (tx) => {
        await lockPlanet(tx, planet.id);
        await this.reflowQueueTimes(tx, planet.id, planet.userId, new Date());
      });
    return this.database.shipQueue.findMany({
      where: {
        completed: false,
        endTime: { lte: new Date() },
      },
    });
  }

  private refundFor(entry: {
    paidCost: Prisma.JsonValue;
    shipId: number;
    amount: number;
  }) {
    const paid = entry.paidCost as Partial<ShipCost> | null;
    // Legacy rows predate paidCost; preserve their base-cost fallback explicitly.
    const cost = (SHIPS[entry.shipId] ?? DEFENSES[entry.shipId]).cost;
    const refund = (key: keyof ShipCost) =>
      Math.floor((paid?.[key] ?? cost[key] * entry.amount) * 0.9);
    return {
      metal: refund("metal"),
      crystal: refund("crystal"),
      deuterium: refund("deuterium"),
    };
  }

  private async reflowQueueTimes(
    tx: Prisma.TransactionClient,
    planetId: string,
    userId: string,
    now: Date,
  ) {
    const queue = await tx.shipQueue.findMany({
      where: { planetId, completed: false },
    });
    const { productionCapacity } = await this.progression.get(userId, tx);
    for (const entry of scheduleProduction(queue, productionCapacity, now)) {
      await tx.shipQueue.update({
        where: { id: entry.id },
        data: { startTime: entry.startTime, endTime: entry.endTime },
      });
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
  ) {
    return this.checkRequirements(shipId, planetBuildings, userTechnologies);
  }

  /** Prérequis d'un vaisseau (ids 2xx) ou d'une défense (ids 4xx). */
  private checkRequirements(
    shipId: number,
    planetBuildings: Record<number, number>,
    userTechnologies: Record<number, number>,
  ): { canBuild: boolean; missingRequirements: string[] } {
    const ship = SHIPS[shipId] ?? DEFENSES[shipId];
    if (!ship) {
      return { canBuild: false, missingRequirements: ["Element introuvable"] };
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
              ? BUILDINGS[reqIdNum]?.name || `Batiment ${reqIdNum}`
              : TECHNOLOGIES[reqIdNum]?.name || `Technologie ${reqIdNum}`;
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
      throw new NotFoundException("Planete introuvable");
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException("Acces refuse");
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
