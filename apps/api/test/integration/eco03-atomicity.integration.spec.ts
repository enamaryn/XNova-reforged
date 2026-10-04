import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BuildingsService } from '../../src/buildings/buildings.service';
import { DatabaseService } from '../../src/database/database.service';
import { FleetService } from '../../src/fleet/fleet.service';
import { ResearchService } from '../../src/research/research.service';
import { ResourcesService } from '../../src/resources/resources.service';
import { ShipyardService } from '../../src/shipyard/shipyard.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

const settle = <T>(promises: Promise<T>[]) => Promise.allSettled(promises);
const ok = (r: PromiseSettledResult<unknown>[]) => r.filter((x) => x.status === 'fulfilled').length;

/**
 * ECO-03 — disponibilités et files atomiques sous requêtes simultanées.
 */
describe('API integration - Atomicité des disponibilités et files (ECO-03)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let buildings: BuildingsService;
  let research: ResearchService;
  let shipyard: ShipyardService;
  let fleet: FleetService;
  let resources: ResourcesService;

  let username: string;
  let userId: string;
  let planetId: string;
  let planet: { galaxy: number; system: number };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    buildings = app.get(BuildingsService);
    research = app.get(ResearchService);
    shipyard = app.get(ShipyardService);
    fleet = app.get(FleetService);
    resources = app.get(ResourcesService);
  });

  beforeEach(async () => {
    const testUser = buildTestUser();
    username = testUser.username;
    const { accessToken } = await registerAndLogin(app, testUser);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    userId = me.body.id;
    planet = me.body.planets[0];
    planetId = planet && me.body.planets[0].id;
  });

  afterEach(async () => {
    await cleanupTestUser(database, username);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const fresh = () => database.planet.findUniqueOrThrow({ where: { id: planetId } });

  it('chantier : budget pour un seul lot, aucun stock négatif', async () => {
    await database.technology.upsert({
      where: { userId_techId: { userId, techId: 115 } },
      update: { level: 5 },
      create: { userId, techId: 115, level: 5 },
    });
    await database.planet.update({
      where: { id: planetId },
      data: { metal: 2000, crystal: 2000, deuterium: 0, shipyard: 2, lastUpdate: new Date() },
    });

    const results = await settle(
      Array.from({ length: 6 }, () => shipyard.startBuild(planetId, 202, 1, userId)),
    );

    const after = await fresh();
    expect(ok(results)).toBe(1);
    expect(after.metal).toBeGreaterThanOrEqual(0);
    expect(after.crystal).toBeGreaterThanOrEqual(0);
    expect(await database.shipQueue.count({ where: { planetId } })).toBe(1);
  });

  it('bâtiment : une seule construction identique, un seul débit', async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { metal: 100000, crystal: 100000, deuterium: 100000, lastUpdate: new Date() },
    });

    const results = await settle(
      Array.from({ length: 6 }, () => buildings.startConstruction(planetId, 1, userId)),
    );

    expect(ok(results)).toBe(1);
    expect(
      await database.buildQueue.count({ where: { planetId, buildingId: 1, completed: false } }),
    ).toBe(1);
    const after = await fresh();
    expect(after.metal).toBeCloseTo(100000 - 60, 1); // coût niveau 0 de la mine de métal
  });

  it('recherche : une seule recherche active par joueur', async () => {
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 100000,
        crystal: 100000,
        deuterium: 100000,
        researchLab: 10,
        lastUpdate: new Date(),
      },
    });

    const results = await settle(
      Array.from({ length: 6 }, () => research.startResearch(planetId, 113, userId)),
    );

    expect(ok(results)).toBe(1);
    expect(await database.researchQueue.count({ where: { userId, completed: false } })).toBe(1);
  });

  it('flotte : un vaisseau ne peut partir qu\'une fois', async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { metal: 100000, crystal: 100000, deuterium: 100000, lastUpdate: new Date() },
    });
    await database.ship.upsert({
      where: { planetId_shipId: { planetId, shipId: 202 } },
      update: { amount: 3 },
      create: { planetId, shipId: 202, amount: 3 },
    });

    const dto = {
      planetId,
      toGalaxy: planet.galaxy,
      toSystem: planet.system + 1,
      toPosition: 1,
      mission: 3,
      speedPercent: 100,
      ships: { '202': 3 },
      cargo: { metal: 0, crystal: 0, deuterium: 0 },
    } as any;

    const results = await settle(Array.from({ length: 5 }, () => fleet.sendFleet(dto, userId)));

    const row = await database.ship.findUniqueOrThrow({
      where: { planetId_shipId: { planetId, shipId: 202 } },
    });
    expect(ok(results)).toBe(1);
    expect(row.amount).toBe(0);
    expect(await database.fleet.count({ where: { userId } })).toBe(1);
  });

  it('colonisation : un seul colonisateur donne une seule planète', async () => {
    await database.ship.upsert({
      where: { planetId_shipId: { planetId, shipId: 208 } },
      update: { amount: 1 },
      create: { planetId, shipId: 208, amount: 1 },
    });

    const results = await settle(
      [1, 2, 3, 4].map((position) =>
        resources.colonizePlanet({
          userId,
          originPlanetId: planetId,
          galaxy: 9,
          system: 499,
          position,
          name: 'Colonie',
        }),
      ),
    );

    const row = await database.ship.findUniqueOrThrow({
      where: { planetId_shipId: { planetId, shipId: 208 } },
    });
    expect(ok(results)).toBe(1);
    expect(row.amount).toBe(0);
    expect(await database.planet.count({ where: { userId } })).toBe(2);
  });

  it('annulation contre finalisation : jamais les deux effets', async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { metal: 100000, crystal: 100000, deuterium: 100000, lastUpdate: new Date() },
    });
    const started = await buildings.startConstruction(planetId, 1, userId);
    const before = await fresh();
    const entry = await database.buildQueue.findUniqueOrThrow({ where: { id: started.queueId } });

    const results = await settle([
      buildings.cancelConstruction(entry.id, userId),
      buildings.completeConstruction(entry),
    ]);

    const after = await fresh();
    const cancelled = results[0].status === 'fulfilled';
    const level = after.metalMine;
    // Annulé : remboursé et niveau inchangé ; sinon : terminé, sans remboursement.
    if (cancelled) {
      expect(level).toBe(0);
      expect(after.metal).toBeCloseTo(before.metal + 60, 1);
    } else {
      expect(level).toBe(1);
      expect(after.metal).toBeCloseTo(before.metal, 1);
    }
  });
});
