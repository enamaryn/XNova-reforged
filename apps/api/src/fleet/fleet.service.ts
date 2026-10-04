import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServerConfigService } from '../server-config/server-config.service';
import {
  COLONY_SHIP_ID,
  ESPIONAGE_PROBE_ID,
  GAME_CONSTANTS,
  IMPLEMENTED_MISSIONS,
  MissionType,
  SHIPS,
  getShipSpeed,
} from '@xnova/game-config';
import {
  calculateDistance,
  calculateFleetSpeed,
  calculateFlightDurationSeconds,
  calculateFuelConsumption,
} from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';
import { debitResources, debitShips, lockPlanet } from '../common/atomic';
import { MAX_QUANTITY, SendFleetDto } from './dto/send-fleet.dto';

@Injectable()
export class FleetService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  async getAvailableShips(planetId: string, userId: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: planetId },
      select: { id: true, userId: true },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    const ships = await this.database.ship.findMany({
      where: { planetId },
      select: { shipId: true, amount: true },
    });

    const amounts = new Map<number, number>();
    ships.forEach((ship) => amounts.set(ship.shipId, ship.amount));

    const shipList = Object.values(SHIPS).map((ship) => ({
      shipId: ship.id,
      name: ship.name,
      amount: amounts.get(ship.id) ?? 0,
    }));

    return {
      planetId,
      ships: shipList,
    };
  }

  async getActiveFleets(userId: string) {
    const fleets = await this.database.fleet.findMany({
      where: {
        userId,
        status: { in: ['traveling', 'arrived', 'returning'] },
      },
      orderBy: { arrivalTime: 'asc' },
      select: {
        id: true,
        fromGalaxy: true,
        fromSystem: true,
        fromPosition: true,
        toGalaxy: true,
        toSystem: true,
        toPosition: true,
        mission: true,
        ships: true,
        cargo: true,
        startTime: true,
        arrivalTime: true,
        returnTime: true,
        status: true,
      },
    });

    return fleets;
  }

  async sendFleet(dto: SendFleetDto, userId: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: dto.planetId },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    // Règles de validation (GAME-01) : tout est refusé avant le moindre débit
    if (!IMPLEMENTED_MISSIONS.includes(dto.mission)) {
      throw new BadRequestException('Mission non disponible');
    }

    if (
      dto.toGalaxy < 1 ||
      dto.toGalaxy > GAME_CONSTANTS.MAX_GALAXIES ||
      dto.toSystem < 1 ||
      dto.toSystem > GAME_CONSTANTS.MAX_SYSTEMS ||
      dto.toPosition < 1 ||
      dto.toPosition > GAME_CONSTANTS.MAX_POSITIONS
    ) {
      throw new BadRequestException('Coordonnees invalides');
    }

    const shipsToSend = this.parseShips(dto.ships);

    if (
      planet.galaxy === dto.toGalaxy &&
      planet.system === dto.toSystem &&
      planet.position === dto.toPosition
    ) {
      throw new BadRequestException('La destination ne peut pas etre la planete d\'origine');
    }

    const target = await this.database.planet.findUnique({
      where: {
        galaxy_system_position: {
          galaxy: dto.toGalaxy,
          system: dto.toSystem,
          position: dto.toPosition,
        },
      },
      select: { userId: true },
    });

    if (dto.mission === MissionType.ATTACK) {
      if (!target) throw new BadRequestException('Aucune planete a cette position');
      if (target.userId === userId) {
        throw new BadRequestException('Vous ne pouvez pas attaquer votre propre planete');
      }
    } else if (dto.mission === MissionType.DEPLOY) {
      if (!target || target.userId !== userId) {
        throw new BadRequestException('Le deploiement exige une de vos planetes');
      }
    } else if (dto.mission === MissionType.SPY) {
      // Espionnage : uniquement des sondes, vers la planete d'un autre joueur
      if (shipsToSend.some((ship) => ship.shipId !== ESPIONAGE_PROBE_ID)) {
        throw new BadRequestException('Une mission d\'espionnage n\'accepte que des sondes d\'espionnage');
      }
      if (!target) throw new BadRequestException('Aucune planete a cette position');
      if (target.userId === userId) {
        throw new BadRequestException('Vous ne pouvez pas espionner votre propre planete');
      }
    } else if (dto.mission === MissionType.COLONIZE) {
      // Colonisation : au moins un vaisseau de colonisation, vers une position libre
      if (!shipsToSend.some((ship) => ship.shipId === COLONY_SHIP_ID)) {
        throw new BadRequestException('Une mission de colonisation exige un vaisseau de colonisation');
      }
      if (target) throw new BadRequestException('Cette position est deja occupee');
      const owned = await this.database.planet.count({ where: { userId } });
      if (owned >= GAME_CONSTANTS.MAX_PLAYER_PLANETS) {
        throw new BadRequestException('Nombre maximal de planetes atteint');
      }
    } else if (!target) {
      // TRANSPORT : la cible doit exister
      throw new BadRequestException('Aucune planete a cette position');
    }

    const shipRows = await this.database.ship.findMany({
      where: {
        planetId: dto.planetId,
        shipId: { in: shipsToSend.map((s) => s.shipId) },
      },
      select: { shipId: true, amount: true },
    });

    const available = new Map<number, number>();
    shipRows.forEach((row) => available.set(row.shipId, row.amount));

    shipsToSend.forEach((ship) => {
      const amount = available.get(ship.shipId) ?? 0;
      if (amount < ship.amount) {
        throw new BadRequestException(
          `Vaisseaux insuffisants pour ${SHIPS[ship.shipId].name}`,
        );
      }
    });

    const cargo = {
      metal: this.parseQuantity(dto.cargo?.metal),
      crystal: this.parseQuantity(dto.cargo?.crystal),
      deuterium: this.parseQuantity(dto.cargo?.deuterium),
    };

    // Espionnage et colonisation n'embarquent aucune ressource
    if (
      (dto.mission === MissionType.SPY || dto.mission === MissionType.COLONIZE) &&
      cargo.metal + cargo.crystal + cargo.deuterium > 0
    ) {
      throw new BadRequestException('Cette mission n\'accepte aucune cargaison');
    }

    const cargoTotal = cargo.metal + cargo.crystal + cargo.deuterium;
    const cargoCapacity = shipsToSend.reduce(
      (sum, ship) => sum + SHIPS[ship.shipId].cargo * ship.amount,
      0,
    );

    if (cargoTotal > cargoCapacity) {
      throw new BadRequestException('Capacite de cargaison insuffisante');
    }

    const techRows = await this.database.technology.findMany({
      where: { userId, techId: { in: [115, 117, 118] } },
    });
    const techLevels = new Map<number, number>();
    techRows.forEach((row) => techLevels.set(row.techId, row.level));

    const combustion = techLevels.get(115) ?? 0;
    const impulse = techLevels.get(117) ?? 0;
    const hyperspace = techLevels.get(118) ?? 0;

    const shipSpeeds = shipsToSend.map((ship) =>
      getShipSpeed(ship.shipId, combustion, impulse, hyperspace),
    );

    const fleetSpeed = calculateFleetSpeed(shipSpeeds);
    if (!fleetSpeed) {
      throw new BadRequestException('Vitesse flotte invalide');
    }

    const distance = calculateDistance(
      {
        galaxy: planet.galaxy,
        system: planet.system,
        position: planet.position,
      },
      {
        galaxy: dto.toGalaxy,
        system: dto.toSystem,
        position: dto.toPosition,
      },
    );

    const speedPercent = dto.speedPercent || 100;
    const durationSeconds = calculateFlightDurationSeconds({
      distance,
      fleetSpeed,
      speedPercent,
    });

    const fuelConsumption = calculateFuelConsumption({
      distance,
      fleetSpeed,
      ships: shipsToSend.map((ship) => ({
        amount: ship.amount,
        consumption: SHIPS[ship.shipId].consumption,
      })),
    });

    if (
      planet.metal < cargo.metal ||
      planet.crystal < cargo.crystal ||
      planet.deuterium < cargo.deuterium + fuelConsumption
    ) {
      throw new BadRequestException('Ressources insuffisantes');
    }

    const { fleetSpeed: gameSpeed } = await this.serverConfig.getConfig();
    const adjustedDuration = Math.max(
      1,
      Math.floor(durationSeconds / gameSpeed),
    );

    const now = new Date();
    const arrivalTime = new Date(now.getTime() + adjustedDuration * 1000);
    const returnTime = new Date(arrivalTime.getTime() + adjustedDuration * 1000);

    const shipsPayload = shipsToSend.reduce((acc, ship) => {
      acc[ship.shipId] = ship.amount;
      return acc;
    }, {} as Record<number, number>);

    const fleet = await this.database.$transaction(async (tx) => {
      // Verrou planete, puis debits conditionnels : pas de stock negatif ni de double usage de vaisseaux (ECO-03)
      await lockPlanet(tx, dto.planetId);

      await debitResources(tx, dto.planetId, {
        metal: cargo.metal,
        crystal: cargo.crystal,
        deuterium: cargo.deuterium + fuelConsumption,
      });

      for (const ship of shipsToSend) {
        await debitShips(
          tx,
          dto.planetId,
          ship.shipId,
          ship.amount,
          `Vaisseaux insuffisants pour ${SHIPS[ship.shipId].name}`,
        );
      }

      return tx.fleet.create({
        data: {
          userId,
          fromGalaxy: planet.galaxy,
          fromSystem: planet.system,
          fromPosition: planet.position,
          toGalaxy: dto.toGalaxy,
          toSystem: dto.toSystem,
          toPosition: dto.toPosition,
          mission: dto.mission,
          ships: shipsPayload,
          cargo,
          colonyName: dto.mission === MissionType.COLONIZE ? dto.planetName?.trim() || 'Colonie' : null,
          startTime: now,
          arrivalTime,
          returnTime,
          status: 'traveling',
        },
      });
    });

    return {
      success: true,
      fleetId: fleet.id,
      durationSeconds: adjustedDuration,
      fuelConsumption,
      mission: dto.mission,
      arrivalTime,
    };
  }

  /** Liste de vaisseaux : identifiants connus, quantités entières strictement positives. */
  private parseShips(raw: unknown): { shipId: number; amount: number }[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('Liste de vaisseaux invalide');
    }

    const result: { shipId: number; amount: number }[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^\d+$/.test(key) || !SHIPS[Number(key)]) {
        throw new BadRequestException(`Vaisseau invalide: ${key}`);
      }
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > MAX_QUANTITY
      ) {
        throw new BadRequestException(`Quantite invalide pour le vaisseau ${key}`);
      }
      result.push({ shipId: Number(key), amount: value });
    }

    if (result.length === 0) {
      throw new BadRequestException('Aucun vaisseau selectionne');
    }
    return result;
  }

  /** Quantité de ressources : entier fini compris entre 0 et la borne maximale. */
  private parseQuantity(value: unknown): number {
    if (value === undefined || value === null) return 0;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_QUANTITY) {
      throw new BadRequestException('Quantite de ressources invalide');
    }
    return value;
  }

  async recallFleet(fleetId: string, userId: string) {
    const fleet = await this.database.fleet.findUnique({
      where: { id: fleetId },
    });

    if (!fleet) {
      throw new NotFoundException('Flotte introuvable');
    }

    if (fleet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    if (fleet.status !== 'traveling') {
      throw new BadRequestException('La flotte ne peut pas etre rappelee');
    }

    const now = new Date();
    if (fleet.arrivalTime <= now) {
      throw new BadRequestException('La flotte est deja arrivee');
    }

    const elapsedSeconds = Math.max(
      1,
      Math.floor((now.getTime() - fleet.startTime.getTime()) / 1000),
    );
    const returnTime = new Date(now.getTime() + elapsedSeconds * 1000);

    // Rappel atomique : refuse si la flotte vient d'etre prise en charge par l'arrivee (ECO-04)
    const recalled = await this.database.fleet.updateMany({
      where: { id: fleet.id, status: 'traveling', arrivalTime: { gt: now } },
      data: { status: 'returning', returnTime },
    });
    if (recalled.count !== 1) {
      throw new BadRequestException('La flotte ne peut pas etre rappelee');
    }
    const updatedFleet = await this.database.fleet.findUniqueOrThrow({
      where: { id: fleet.id },
    });

    return {
      success: true,
      fleetId: updatedFleet.id,
      returnTime: updatedFleet.returnTime,
    };
  }

}
