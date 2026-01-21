import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GAME_CONSTANTS } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';

const MAX_POSITIONS = GAME_CONSTANTS.MAX_POSITIONS;
const ABANDONED_USER = {
  username: '__abandoned__',
  email: 'abandoned@xnova.local',
};
const ABANDONED_PLANETS = 200;

@Injectable()
export class GalaxyService implements OnModuleInit {
  private readonly logger = new Logger(GalaxyService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  async onModuleInit() {
    await this.seedGalaxy();
  }

  async getSystem(galaxy: number, system: number, userId: string) {
    const planets = await this.database.planet.findMany({
      where: { galaxy, system },
      select: {
        id: true,
        name: true,
        position: true,
        userId: true,
        moonBase: true,
        user: {
          select: {
            id: true,
            username: true,
            lastActive: true,
            allianceMember: {
              select: {
                alliance: {
                  select: {
                    tag: true,
                  },
                },
              },
            },
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

      const isAbandoned = planet.user?.username === ABANDONED_USER.username;
      const lastActive = planet.user?.lastActive;
      const activityMinutes = lastActive
        ? Math.floor((Date.now() - lastActive.getTime()) / 60000)
        : null;

      return {
        position,
        occupied: true,
        planetId: planet.id,
        name: planet.name,
        owner: isAbandoned ? 'Abandonnée' : planet.user?.username ?? 'Inconnu',
        ownerId: planet.user?.id ?? null,
        allianceTag: planet.user?.allianceMember?.alliance?.tag ?? null,
        activityMinutes: isAbandoned ? null : activityMinutes,
        hasMoon: planet.moonBase > 0,
        isOwn: planet.userId === userId,
      };
    });

    return {
      galaxy,
      system,
      positions,
    };
  }

  private async seedGalaxy() {
    const abandonedUser = await this.database.user.upsert({
      where: { username: ABANDONED_USER.username },
      update: {},
      create: {
        username: ABANDONED_USER.username,
        email: ABANDONED_USER.email,
        password: '__abandoned__',
      },
    });

    const existingAbandoned = await this.database.planet.count({
      where: { userId: abandonedUser.id },
    });

    if (existingAbandoned > 0) {
      this.logger.log('Galaxy seed already present, skipping.');
      return;
    }

    const occupied = new Set<string>();
    const existingPlanets = await this.database.planet.findMany({
      select: { galaxy: true, system: true, position: true },
    });
    existingPlanets.forEach((planet) => {
      occupied.add(`${planet.galaxy}:${planet.system}:${planet.position}`);
    });

    const config = await this.serverConfig.getConfig();

    const planets: {
      userId: string;
      name: string;
      galaxy: number;
      system: number;
      position: number;
      planetType: string;
      metal: number;
      crystal: number;
      deuterium: number;
      fieldsMax: number;
      fieldsUsed: number;
    }[] = [];

    let attempts = 0;
    const maxAttempts = ABANDONED_PLANETS * 20;

    while (planets.length < ABANDONED_PLANETS && attempts < maxAttempts) {
      attempts += 1;
      const galaxy = Math.floor(Math.random() * GAME_CONSTANTS.MAX_GALAXIES) + 1;
      const system = Math.floor(Math.random() * GAME_CONSTANTS.MAX_SYSTEMS) + 1;
      const position = Math.floor(Math.random() * GAME_CONSTANTS.MAX_POSITIONS) + 1;
      const key = `${galaxy}:${system}:${position}`;

      if (occupied.has(key)) {
        continue;
      }

      occupied.add(key);
      planets.push({
        userId: abandonedUser.id,
        name: 'Planète abandonnée',
        galaxy,
        system,
        position,
        planetType: 'normal',
        metal: 0,
        crystal: 0,
        deuterium: 0,
        fieldsMax: config.planetSize,
        fieldsUsed: 0,
      });
    }

    if (planets.length > 0) {
      await this.database.planet.createMany({ data: planets });
      this.logger.log(`Galaxy seed created: ${planets.length} planètes abandonnées.`);
    } else {
      this.logger.warn('Galaxy seed skipped: aucune position libre.');
    }
  }
}
