import { DatabaseService } from '../../src/database/database.service';
import { ResourcesService } from '../../src/resources/resources.service';

/**
 * ECO-01 (niveau API + PostgreSQL) — une planète interrogée très souvent ne perd aucune fraction
 * de production : 360 rafraîchissements de 10 s donnent le même stock qu'un seul d'une heure.
 */
describe('API integration - API interrogée fréquemment (ECO-01)', () => {
  const database = new DatabaseService();
  const serverConfig = {
    getResourceConfig: async () => ({
      baseIncome: { metal: 20, crystal: 10, deuterium: 0 },
      resourceMultiplier: 1,
      gameSpeed: 1,
      storageBase: 1_000_000,
      storageFactor: 1.5,
      storageOverflow: 1.1,
    }),
    getConfig: async () => ({ planetSize: 163 }),
  };
  const service = new ResourcesService(database as any, serverConfig as any);

  let userId: string;
  let planetId: string;

  beforeAll(async () => {
    await database.$connect();
    const suffix = Math.random().toString(36).slice(2, 10);
    const user = await database.user.create({
      data: {
        username: `eco01_${suffix}`,
        email: `eco01_${suffix}@example.test`,
        password: 'x',
        lastActive: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // hors cron de production
      },
    });
    userId = user.id;
    const planet = await database.planet.create({
      data: {
        userId,
        name: 'ECO01',
        galaxy: 9,
        system: 450 + Math.floor(Math.random() * 40),
        position: 1 + Math.floor(Math.random() * 15),
        metal: 500,
        crystal: 500,
        deuterium: 0,
      },
    });
    planetId = planet.id;
  });

  afterAll(async () => {
    await database.user.delete({ where: { id: userId } }).catch(() => undefined);
    await database.$disconnect();
  });

  it('360 interrogations espacées de 10 s conservent la production d\'une heure (520 / 510)', async () => {
    let last: Awaited<ReturnType<ResourcesService['getPlanetResources']>> | undefined;

    for (let i = 0; i < 360; i += 1) {
      // Chaque appel couvre une période de 10 s, comme une API interrogée toutes les 10 s
      await database.planet.update({
        where: { id: planetId },
        data: { lastUpdate: new Date(Date.now() - 10_000) },
      });
      last = await service.getPlanetResources(planetId, userId);
    }

    const planet = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    // Avant le correctif (stock tronqué à chaque appel) : 500 / 500
    expect(planet.metal).toBeCloseTo(520, 1);
    expect(planet.crystal).toBeCloseTo(510, 1);

    // L'API expose des valeurs entières, la base garde les fractions
    expect(last!.resources.metal).toBe(Math.floor(planet.metal));
    expect(Number.isInteger(last!.resources.crystal)).toBe(true);
  }, 120_000);
});
