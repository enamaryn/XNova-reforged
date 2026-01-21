import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Planètes & Bâtiments', () => {
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

  it('affiche les bâtiments et gère la queue (build + cancel)', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);
    expect(accessToken).toBeTruthy();

    const server = app.getHttpServer();
    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;
    expect(planetId).toBeTruthy();

    const buildingsResponse = await request(server)
      .get(`/planets/${planetId}/buildings`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(buildingsResponse.body?.buildings?.length).toBeGreaterThan(0);
    const mine = buildingsResponse.body.buildings.find((b) => b.id === 1);
    expect(mine).toBeDefined();

    const startResponse = await request(server)
      .post(`/planets/${planetId}/build`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ buildingId: 1 })
      .expect(201);

    const queueId = startResponse.body?.queueId;
    expect(queueId).toBeTruthy();

    const queueResponse = await request(server)
      .get(`/planets/${planetId}/build-queue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(queueResponse.body?.length).toBeGreaterThan(0);

    await request(server)
      .delete(`/planets/${planetId}/build-queue/${queueId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const postCancelQueue = await request(server)
      .get(`/planets/${planetId}/build-queue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(postCancelQueue.body?.length).toBe(0);

    await cleanupTestUser(database, testUser.username);
  });
});
