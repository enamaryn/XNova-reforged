import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Flottes', () => {
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('liste les vaisseaux disponibles et les flottes actives', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);
    expect(accessToken).toBeTruthy();

    const server = app.getHttpServer();

    // Récupérer la planète du joueur
    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;
    expect(planetId).toBeTruthy();

    // GET /fleet/available/:planetId - Vaisseaux disponibles
    const availableResponse = await request(server)
      .get(`/fleet/available/${planetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(availableResponse.body).toBeDefined();

    // GET /fleet/active - Flottes actives (devrait être vide au départ)
    const activeResponse = await request(server)
      .get('/fleet/active')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(activeResponse.body)).toBe(true);

    await cleanupTestUser(database, testUser.username);
  });

  it('envoie une flotte et la rappelle', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    // Récupérer la planète du joueur
    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planet = meResponse.body?.planets?.[0];
    const planetId = planet?.id;
    expect(planetId).toBeTruthy();

    // Ajouter des ressources et des vaisseaux au joueur
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 100000,
        crystal: 100000,
        deuterium: 50000,
      },
    });

    // Ajouter des petits transporteurs (ID 202)
    await database.ship.upsert({
      where: {
        planetId_shipId: { planetId, shipId: 202 },
      },
      update: { amount: 10 },
      create: { planetId, shipId: 202, amount: 10 },
    });

    // Destination : planète d'un autre joueur (GAME-01 exige une cible existante)
    const rival = await database.user.create({
      data: {
        username: `fleetr_${Math.random().toString(36).slice(2, 10)}`,
        email: `fleetr_${Math.random().toString(36).slice(2, 10)}@example.test`,
        password: 'x',
      },
    });
    const targetPlanet = await database.planet.create({
      data: { userId: rival.id, name: 'Cible', galaxy: 9, system: 497, position: 1 + Math.floor(Math.random() * 15) },
    });

    // POST /fleet/send - Envoyer une flotte (mission transport = 3)
    const sendResponse = await request(server)
      .post('/fleet/send')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planetId: planetId,
        toGalaxy: targetPlanet.galaxy,
        toSystem: targetPlanet.system,
        toPosition: targetPlanet.position,
        mission: 3, // Transport
        speedPercent: 100,
        ships: { '202': 2 },
        cargo: { metal: 100, crystal: 50, deuterium: 0 },
      })
      .expect(201);

    const fleetId = sendResponse.body?.fleetId;
    expect(fleetId).toBeTruthy();

    // GET /fleet/active - Vérifier que la flotte est active
    const activeResponse = await request(server)
      .get('/fleet/active')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(activeResponse.body.length).toBeGreaterThan(0);

    // DELETE /fleet/:fleetId - Rappeler la flotte
    await request(server)
      .delete(`/fleet/${fleetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await database.user.delete({ where: { id: rival.id } });
    await cleanupTestUser(database, testUser.username);
  });

  it('refuse envoi sans vaisseaux', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planet = meResponse.body?.planets?.[0];
    const planetId = planet?.id;

    // Cible valide, pour que seul le manque de vaisseaux justifie le refus
    const rival = await database.user.create({
      data: {
        username: `fleetn_${Math.random().toString(36).slice(2, 10)}`,
        email: `fleetn_${Math.random().toString(36).slice(2, 10)}@example.test`,
        password: 'x',
      },
    });
    const targetPlanet = await database.planet.create({
      data: { userId: rival.id, name: 'Cible', galaxy: 9, system: 496, position: 1 + Math.floor(Math.random() * 15) },
    });

    // Tenter d'envoyer une flotte sans vaisseaux disponibles : 400 précis, jamais 500
    const sendResponse = await request(server)
      .post('/fleet/send')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planetId: planetId,
        toGalaxy: targetPlanet.galaxy,
        toSystem: targetPlanet.system,
        toPosition: targetPlanet.position,
        mission: 3,
        speedPercent: 100,
        ships: { '202': 5 }, // Pas de vaisseaux disponibles
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
      });

    expect(sendResponse.status).toBe(400);
    expect(String(sendResponse.body.message)).toMatch(/insuffisants/i);

    await database.user.delete({ where: { id: rival.id } });
    await cleanupTestUser(database, testUser.username);
  });
});
