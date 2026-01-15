import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const MAX_POSITIONS = 15;

@Injectable()
export class GalaxyService {
  constructor(private readonly database: DatabaseService) {}

  async getSystem(galaxy: number, system: number, userId: string) {
    const planets = await this.database.planet.findMany({
      where: { galaxy, system },
      select: {
        id: true,
        name: true,
        position: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const planetMap = new Map<number, typeof planets[number]>();
    planets.forEach((planet) => planetMap.set(planet.position, planet));

    const positions = Array.from({ length: MAX_POSITIONS }, (_, index) => {
      const position = index + 1;
      const planet = planetMap.get(position);

      if (!planet) {
        return {
          position,
          occupied: false,
        };
      }

      return {
        position,
        occupied: true,
        planetId: planet.id,
        name: planet.name,
        owner: planet.user?.username ?? 'Inconnu',
        isOwn: planet.userId === userId,
      };
    });

    return {
      galaxy,
      system,
      positions,
    };
  }
}
