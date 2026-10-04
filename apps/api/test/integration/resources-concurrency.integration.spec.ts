import { ResourcesService } from '../../src/resources/resources.service';
import { DatabaseService } from '../../src/database/database.service';

/**
 * ECO-02 — le rafraîchissement ne doit pas écraser les débits/crédits concurrents.
 * Bilan attendu : initial + production(période couverte) + crédits − débits.
 */
describe('API integration - Concurrence des ressources (ECO-02)', () => {
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
  let initialLastUpdate: Date;
  const INITIAL = 10_000;

  beforeAll(async () => {
    await database.$connect();
    const suffix = Math.random().toString(36).slice(2, 10);
    const user = await database.user.create({
      data: { username: `eco02_${suffix}`, email: `eco02_${suffix}@example.test`, password: 'x' },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    initialLastUpdate = new Date(Date.now() - 3_600_000);
    await database.planet.deleteMany({ where: { userId } });
    const planet = await database.planet.create({
      data: {
        userId,
        name: 'ECO02',
        galaxy: 1 + Math.floor(Math.random() * 9),
        system: 1 + Math.floor(Math.random() * 499),
        position: 1 + Math.floor(Math.random() * 15),
        metal: INITIAL,
        crystal: INITIAL,
        deuterium: INITIAL,
        lastUpdate: initialLastUpdate,
      },
    });
    planetId = planet.id;
  });

  afterAll(async () => {
    await database.user.delete({ where: { id: userId } }).catch(() => undefined);
    await database.$disconnect();
  });

  it('conserve le bilan entre rafraîchissements, débits et crédits concurrents', async () => {
    const ops: Promise<unknown>[] = [];
    let credits = 0;
    let debits = 0;

    for (let i = 0; i < 20; i++) {
      ops.push(service.getPlanetResources(planetId, userId));
      ops.push(
        database.planet.update({ where: { id: planetId }, data: { metal: { decrement: 7 } } }),
      );
      debits += 7;
      ops.push(
        database.planet.update({ where: { id: planetId }, data: { metal: { increment: 3 } } }),
      );
      credits += 3;
    }
    await Promise.all(ops);

    const final = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    const hours = (final.lastUpdate.getTime() - initialLastUpdate.getTime()) / 3_600_000;

    expect(hours).toBeGreaterThan(0.99);
    expect(final.metal).toBeCloseTo(INITIAL + 20 * hours + credits - debits, 4);
    expect(final.crystal).toBeCloseTo(INITIAL + 10 * hours, 4);
    expect(final.deuterium).toBeCloseTo(INITIAL, 4);
  });

  it('ne produit pas deux fois la même période lors de rafraîchissements parallèles', async () => {
    await Promise.all(
      Array.from({ length: 15 }, () => service.getPlanetResources(planetId, userId)),
    );

    const final = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    const hours = (final.lastUpdate.getTime() - initialLastUpdate.getTime()) / 3_600_000;
    expect(final.metal).toBeCloseTo(INITIAL + 20 * hours, 4);
  });
});
