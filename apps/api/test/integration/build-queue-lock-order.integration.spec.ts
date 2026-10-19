import { BadRequestException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BuildingsService } from '../../src/buildings/buildings.service';
import { lockPlanet } from '../../src/common/atomic';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Ordre de verrouillage planète → file de construction.
 *
 * La finalisation verrouille la planète puis prend l'entrée de file en charge ; l'annulation faisait l'inverse
 * (file puis crédit de la planète). Une annulation au moment exact de la finalisation produisait un interblocage
 * PostgreSQL (`deadlock detected`) : une des deux requêtes échouait en erreur 500. Ces tests rejouent l'entrelacement
 * fautif de façon déterministe, puis par répétition.
 */
describe('API integration - ordre de verrouillage des files de construction', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let buildings: BuildingsService;
  let username: string;
  let userId: string;
  let planetId: string;

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    buildings = app.get(BuildingsService);
  });

  beforeEach(async () => {
    const testUser = buildTestUser();
    username = testUser.username;
    const { accessToken } = await registerAndLogin(app, testUser);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    userId = me.body.id;
    planetId = me.body.planets[0].id;
    await database.planet.update({
      where: { id: planetId },
      data: { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, lastUpdate: new Date() },
    });
  });

  afterEach(async () => {
    await cleanupTestUser(database, username);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("annulation pendant que la finalisation tient la planète : pas d'interblocage, une seule issue", async () => {
    const started = await buildings.startConstruction(planetId, 1, userId);
    const entry = await database.buildQueue.findUniqueOrThrow({ where: { id: started.queueId } });
    const before = await database.planet.findUniqueOrThrow({ where: { id: planetId } });

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const hasLock = new Promise<void>((resolve) => (locked = resolve));

    // Finalisation : planète d'abord, puis prise en charge de l'entrée de file
    const finalizer = database.$transaction(
      async (tx) => {
        await lockPlanet(tx, planetId);
        locked();
        await gate;
        const claimed = await tx.buildQueue.updateMany({
          where: { id: entry.id, completed: false },
          data: { completed: true },
        });
        return claimed.count;
      },
      { maxWait: 20_000, timeout: 20_000 },
    );

    await hasLock;
    // L'annulation démarre pendant que la planète est verrouillée
    const cancel = buildings.cancelConstruction(entry.id, userId).then(
      () => 'annulée',
      (error: unknown) => error,
    );
    // Laisse à l'annulation le temps d'atteindre son premier verrou (avant : la file, puis le crédit bloqué)
    await new Promise((resolve) => setTimeout(resolve, 600));
    release();

    // Avant le correctif : PostgreSQL abandonne l'une des deux transactions au bout d'une seconde (40P01)
    expect(await finalizer).toBe(1);
    expect(await cancel).toBeInstanceOf(BadRequestException);

    // La finalisation a gagné : entrée terminée, aucun remboursement
    const after = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    expect(after.metal).toBeCloseTo(before.metal, 1);
    expect((await database.buildQueue.findUniqueOrThrow({ where: { id: entry.id } })).completed).toBe(true);
  });

  it('annulation et finalisation simultanées répétées : jamais d’erreur de base, jamais les deux effets', async () => {
    for (let round = 0; round < 12; round += 1) {
      const started = await buildings.startConstruction(planetId, 1, userId);
      const entry = await database.buildQueue.findUniqueOrThrow({ where: { id: started.queueId } });
      const before = await database.planet.findUniqueOrThrow({ where: { id: planetId } });

      const results = await Promise.allSettled([
        buildings.cancelConstruction(entry.id, userId),
        buildings.completeConstruction(entry),
      ]);

      for (const result of results) {
        if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(BadRequestException);
      }
      const after = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
      const cancelled = results[0].status === 'fulfilled';
      if (cancelled) {
        expect(after.metalMine).toBe(before.metalMine);
        expect(after.metal).toBeGreaterThan(before.metal);
      } else {
        expect(after.metalMine).toBe(before.metalMine + 1);
      }
      expect(await database.buildQueue.count({ where: { planetId, completed: false } })).toBe(0);
    }
  });
});
