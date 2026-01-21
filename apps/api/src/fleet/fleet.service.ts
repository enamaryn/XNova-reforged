import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServerConfigService } from '../server-config/server-config.service';
import { SHIPS, getShipSpeed } from '@xnova/game-config';
import {
  calculateDistance,
  calculateFleetSpeed,
  calculateFlightDurationSeconds,
  calculateFuelConsumption,
} from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';
import { SendFleetDto } from './dto/send-fleet.dto';

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

    const shipsToSend = Object.entries(dto.ships || {})
      .map(([id, amount]) => ({ shipId: Number(id), amount: Number(amount) }))
      .filter((ship) => ship.amount > 0);

    if (shipsToSend.length === 0) {
      throw new BadRequestException('Aucun vaisseau selectionne');
    }

    const invalid = shipsToSend.find((ship) => !SHIPS[ship.shipId]);
    if (invalid) {
      throw new BadRequestException(`Vaisseau invalide: ${invalid.shipId}`);
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
      metal: Math.max(0, dto.cargo?.metal ?? 0),
      crystal: Math.max(0, dto.cargo?.crystal ?? 0),
      deuterium: Math.max(0, dto.cargo?.deuterium ?? 0),
    };

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
      await tx.planet.update({
        where: { id: dto.planetId },
        data: {
          metal: { decrement: cargo.metal },
          crystal: { decrement: cargo.crystal },
          deuterium: { decrement: cargo.deuterium + fuelConsumption },
        },
      });

      await Promise.all(
        shipsToSend.map((ship) =>
          tx.ship.update({
            where: { planetId_shipId: { planetId: dto.planetId, shipId: ship.shipId } },
            data: { amount: { decrement: ship.amount } },
          }),
        ),
      );

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

    const updatedFleet = await this.database.fleet.update({
      where: { id: fleet.id },
      data: { status: 'returning', returnTime },
    });

    return {
      success: true,
      fleetId: updatedFleet.id,
      returnTime: updatedFleet.returnTime,
    };
  }

}
