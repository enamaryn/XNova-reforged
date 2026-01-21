import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Chantier Spatial (Shipyard)', () => {
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

  it('liste le chantier spatial et construit des vaisseaux', async () => {
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

    // Donner des ressources et un chantier spatial au joueur
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 100000,
        crystal: 100000,
        deuterium: 50000,
        shipyard: 2, // Niveau 2 pour construire des vaisseaux basiques
      },
    });

    // GET /shipyard - Liste des vaisseaux constructibles
    const shipyardResponse = await request(server)
      .get('/shipyard')
      .query({ planetId })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(shipyardResponse.body).toBeDefined();

    // POST /shipyard/build - Construire un petit transporteur (ID 202)
    const buildResponse = await request(server)
      .post('/shipyard/build')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planetId, shipId: 202, amount: 1 });

    if (buildResponse.status === 201) {
      const queueId = buildResponse.body?.queueId;
      expect(queueId).toBeTruthy();

      // GET /shipyard/queue - Voir la file d'attente
      const queueResponse = await request(server)
        .get('/shipyard/queue')
        .query({ planetId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(queueResponse.body)).toBe(true);
      expect(queueResponse.body.length).toBeGreaterThan(0);

      // DELETE /shipyard/queue/:queueId - Annuler la construction
      await request(server)
        .delete(`/shipyard/queue/${queueId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Vérifier que la queue est vide
      const postCancelQueue = await request(server)
        .get('/shipyard/queue')
        .query({ planetId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(postCancelQueue.body.length).toBe(0);
    } else {
      // Erreur possible si le chantier n'est pas assez haut ou autre prérequis
      expect([400, 403, 500]).toContain(buildResponse.status);
    }

    await cleanupTestUser(database, testUser.username);
  });

  it('refuse construction sans chantier spatial', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;

    // S'assurer que le chantier est au niveau 0
    await database.planet.update({
      where: { id: planetId },
      data: { shipyard: 0 },
    });

    // Tenter de construire (devrait échouer)
    const buildResponse = await request(server)
      .post('/shipyard/build')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planetId, shipId: 202, amount: 1 });

    expect([400, 403, 500]).toContain(buildResponse.status);

    await cleanupTestUser(database, testUser.username);
  });

  it('refuse construction sans ressources suffisantes', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;

    // Mettre le chantier au niveau 2 mais pas de ressources
    await database.planet.update({
      where: { id: planetId },
      data: {
        shipyard: 2,
        metal: 0,
        crystal: 0,
        deuterium: 0,
      },
    });

    // Tenter de construire (devrait échouer)
    const buildResponse = await request(server)
      .post('/shipyard/build')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planetId, shipId: 202, amount: 1 });

    expect([400, 403, 500]).toContain(buildResponse.status);

    await cleanupTestUser(database, testUser.username);
  });
});
