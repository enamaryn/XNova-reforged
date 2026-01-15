import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SHIPS } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class FleetService {
  constructor(private readonly database: DatabaseService) {}

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
}
