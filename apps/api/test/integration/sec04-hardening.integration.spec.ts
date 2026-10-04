import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp } from './helpers';

/**
 * SEC-04 — limitation de débit login/register, en-têtes de sécurité.
 */
describe('API integration - Protection de connexion et en-têtes (SEC-04)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const saved: Record<string, string | undefined> = {};
  const created: string[] = [];
  const WINDOW_MS = 1500;

  const login = (identifier: string, password = 'mauvais-mot-de-passe') =>
    request(app.getHttpServer()).post('/auth/login').send({ identifier, password });

  beforeAll(async () => {
    for (const key of [
      'RATE_LIMIT_LOGIN_MAX',
      'RATE_LIMIT_LOGIN_WINDOW_MS',
      'RATE_LIMIT_REGISTER_MAX',
      'RATE_LIMIT_REGISTER_WINDOW_MS',
    ]) {
      saved[key] = process.env[key];
    }
    saved.TRUST_PROXY = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1'; // permet de simuler plusieurs IP via X-Forwarded-For
    process.env.RATE_LIMIT_LOGIN_MAX = '4';
    process.env.RATE_LIMIT_LOGIN_WINDOW_MS = String(WINDOW_MS);
    process.env.RATE_LIMIT_REGISTER_MAX = '3';
    process.env.RATE_LIMIT_REGISTER_WINDOW_MS = String(WINDOW_MS);

    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const username of created) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  it('login : 429 avec Retry-After après la limite, puis récupération', async () => {
    const user = buildTestUser();
    created.push(user.username);
    await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

    // 4 tentatives échouées autorisées (401), la 5e est bloquée
    for (let i = 0; i < 4; i++) {
      await login(user.username).expect(401);
    }
    const blocked = await login(user.username);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);

    // Même le bon mot de passe est refusé pendant le blocage
    await login(user.username, user.password).expect(429);

    // Récupération à l'expiration de la fenêtre
    await new Promise((r) => setTimeout(r, WINDOW_MS + 300));
    await login(user.username, user.password).expect(200);
  });

  it('login : le compteur par IP couvre tous les identifiants', async () => {
    const user = buildTestUser();
    created.push(user.username);
    await new Promise((r) => setTimeout(r, WINDOW_MS + 300));
    await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

    // 3 échecs sur le compte + 1 échec sur un autre identifiant : le compteur par IP atteint 4
    await login(user.username).expect(401);
    await login(user.username).expect(401);
    await login(user.username).expect(401);
    await login('autre_inconnu_xyz').expect(401);
    await login('encore_un_inconnu').expect(429);
  });

  it('login : un même compte est limité même depuis des IP différentes', async () => {
    await new Promise((r) => setTimeout(r, WINDOW_MS + 300));
    const attempt = (ip: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ identifier: 'compte_vise_xyz', password: 'mauvais-mot-de-passe' });

    for (let i = 1; i <= 4; i++) {
      await attempt(`203.0.113.${i}`).expect(401);
    }
    // 5e tentative depuis une IP encore vierge : bloquée par le compteur du compte
    await attempt('203.0.113.99').expect(429);
    // Une autre cible depuis cette même IP vierge reste possible
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ identifier: 'autre_cible_xyz', password: 'mauvais-mot-de-passe' })
      .expect(401);
  });

  it('inscription : limitée puis récupérée', async () => {
    await new Promise((r) => setTimeout(r, WINDOW_MS + 300));
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const user = buildTestUser();
      created.push(user.username);
      const res = await request(app.getHttpServer()).post('/auth/register').send(user);
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3)).toEqual([201, 201, 201]);
    expect(statuses[3]).toBe(429);

    await new Promise((r) => setTimeout(r, WINDOW_MS + 300));
    const user = buildTestUser();
    created.push(user.username);
    await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);
  });

  it('en-têtes de sécurité présents, sans X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
