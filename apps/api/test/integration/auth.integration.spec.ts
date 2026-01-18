import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
} from './helpers';

describe('API integration - Auth & Planetes', () => {
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

  it('inscrit, connecte et recupere la planete', async () => {
    const testUser = buildTestUser();

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(registerResponse.body?.tokens?.accessToken).toBeTruthy();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: testUser.username, password: testUser.password })
      .expect(200);

    const accessToken = loginResponse.body?.tokens?.accessToken;
    expect(accessToken).toBeTruthy();

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body?.username).toBe(testUser.username);
    expect(meResponse.body?.planets?.length).toBeGreaterThan(0);

    const planetId = meResponse.body.planets[0].id;
    const planetResponse = await request(app.getHttpServer())
      .get(`/planets/${planetId}/resources`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(planetResponse.body?.planetId).toBe(planetId);
    expect(planetResponse.body?.resources).toBeDefined();

    await cleanupTestUser(database, testUser.username);
  });
});
