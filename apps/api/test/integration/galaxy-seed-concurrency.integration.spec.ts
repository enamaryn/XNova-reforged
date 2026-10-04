import { GalaxyService } from '../../src/galaxy/galaxy.service';
import { DatabaseService } from '../../src/database/database.service';

/**
 * QUAL-01 — le semis de la galaxie ne doit pas échouer ni se dupliquer quand plusieurs
 * instances démarrent en même temps sur une base vide (cause d'échecs aléatoires en CI).
 */
describe('API integration - Semis concurrent de la galaxie (QUAL-01)', () => {
  const database = new DatabaseService();
  const serverConfig = { getConfig: async () => ({ planetSize: 163 }) };
  const service = new GalaxyService(database as any, serverConfig as any);

  beforeAll(async () => {
    await database.$connect();
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('cinq démarrages simultanés sur une galaxie vide : aucune erreur, un seul semis', async () => {
    const abandoned = await database.user.findUnique({ where: { username: '__abandoned__' } });
    if (abandoned) {
      await database.planet.deleteMany({ where: { userId: abandoned.id } });
    }

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => (service as any).seedGalaxy()),
    );

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);

    const user = await database.user.findUniqueOrThrow({ where: { username: '__abandoned__' } });
    const count = await database.planet.count({ where: { userId: user.id } });
    expect(count).toBe(200); // un seul lot, pas cinq
  });
});
