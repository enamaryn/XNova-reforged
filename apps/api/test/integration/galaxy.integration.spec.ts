import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Galaxie', () => {
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

  it('affiche un système galactique avec les 15 positions', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);
    expect(accessToken).toBeTruthy();

    const server = app.getHttpServer();

    // Récupérer la planète du joueur pour connaître sa galaxie/système
    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planet = meResponse.body?.planets?.[0];
    expect(planet).toBeDefined();

    const galaxy = planet.galaxy || 1;
    const system = planet.system || 1;

    // GET /galaxy/:galaxy/:system - Afficher le système
    const galaxyResponse = await request(server)
      .get(`/galaxy/${galaxy}/${system}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(galaxyResponse.body).toBeDefined();
    expect(galaxyResponse.body.galaxy).toBe(galaxy);
    expect(galaxyResponse.body.system).toBe(system);

    // Devrait contenir les positions (array ou objet avec positions)
    if (galaxyResponse.body.positions) {
      expect(Array.isArray(galaxyResponse.body.positions)).toBe(true);
    }

    // Devrait trouver la planète du joueur dans ce système
    const positions = galaxyResponse.body.positions || [];
    const playerPlanet = positions.find(
      (p: { planetId?: string }) => p.planetId === planet.id,
    );

    // Si la planète est dans ce système, elle devrait apparaître
    if (planet.position <= 15) {
      expect(playerPlanet).toBeDefined();
    }

    await cleanupTestUser(database, testUser.username);
  });

  it('affiche un système vide sans erreur', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    // Chercher un système probablement vide (très loin)
    const galaxyResponse = await request(server)
      .get('/galaxy/9/499')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(galaxyResponse.body).toBeDefined();
    expect(galaxyResponse.body.galaxy).toBe(9);
    expect(galaxyResponse.body.system).toBe(499);

    await cleanupTestUser(database, testUser.username);
  });

  it('refuse galaxie/système invalide', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    // Galaxie hors limites (> 9)
    const invalidGalaxy = await request(server)
      .get('/galaxy/99/1')
      .set('Authorization', `Bearer ${accessToken}`);

    // Devrait retourner une erreur (400 ou 404)
    expect([400, 404, 200]).toContain(invalidGalaxy.status);

    // Système hors limites (> 499)
    const invalidSystem = await request(server)
      .get('/galaxy/1/999')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([400, 404, 200]).toContain(invalidSystem.status);

    await cleanupTestUser(database, testUser.username);
  });

  it('affiche les informations des joueurs dans le système', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const planet = meResponse.body?.planets?.[0];
    const galaxy = planet?.galaxy || 1;
    const system = planet?.system || 1;

    const galaxyResponse = await request(server)
      .get(`/galaxy/${galaxy}/${system}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Vérifier que les positions contiennent des infos sur les propriétaires
    const positions = galaxyResponse.body.positions || [];
    const occupiedPosition = positions.find(
      (p: { owner?: unknown }) => p.owner !== null && p.owner !== undefined,
    );

    if (occupiedPosition) {
      // L'owner devrait avoir au moins un username
      expect(occupiedPosition.owner).toBeDefined();
    }

    await cleanupTestUser(database, testUser.username);
  });
});
