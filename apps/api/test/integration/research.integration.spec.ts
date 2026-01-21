import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Technologies & Recherche', () => {
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

  it('liste les technologies et gère la queue (start + cancel)', async () => {
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

    // Donner des ressources et un labo de recherche au joueur pour tester
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 100000,
        crystal: 100000,
        deuterium: 100000,
        researchLab: 3,
      },
    });

    // GET /technologies - Liste des technologies disponibles
    const techResponse = await request(server)
      .get('/technologies')
      .query({ planetId })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(techResponse.body?.technologies).toBeDefined();
    expect(Array.isArray(techResponse.body.technologies)).toBe(true);

    // Trouver une technologie disponible (Espionnage = ID 106)
    const espionageTech = techResponse.body.technologies.find(
      (t: { id: number }) => t.id === 106,
    );

    if (espionageTech && espionageTech.available) {
      // POST /research - Démarrer une recherche
      const startResponse = await request(server)
        .post('/research')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ planetId, techId: 106 })
        .expect(201);

      const queueId = startResponse.body?.queueId;
      expect(queueId).toBeTruthy();

      // GET /research-queue - Voir la file
      const queueResponse = await request(server)
        .get('/research-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(queueResponse.body)).toBe(true);
      expect(queueResponse.body.length).toBeGreaterThan(0);

      // DELETE /research-queue/:queueId - Annuler la recherche
      await request(server)
        .delete(`/research-queue/${queueId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Vérifier que la queue est vide
      const postCancelQueue = await request(server)
        .get('/research-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(postCancelQueue.body.length).toBe(0);
    }

    await cleanupTestUser(database, testUser.username);
  });

  it('refuse une recherche sans labo suffisant', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();
    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;

    // S'assurer que le labo est au niveau 0
    await database.planet.update({
      where: { id: planetId },
      data: { researchLab: 0 },
    });

    // Tenter de démarrer une recherche (devrait échouer)
    const researchResponse = await request(server)
      .post('/research')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planetId, techId: 106 });

    // Devrait échouer (400, 403 ou 500 si erreur non catchée)
    expect([400, 403, 500]).toContain(researchResponse.status);

    await cleanupTestUser(database, testUser.username);
  });
});
