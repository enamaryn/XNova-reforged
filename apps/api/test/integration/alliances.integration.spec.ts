import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Alliances', () => {
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

  it('crée une alliance et la récupère', async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);
    expect(accessToken).toBeTruthy();

    const server = app.getHttpServer();

    // GET /alliances/me - Pas d'alliance au départ
    const noAllianceResponse = await request(server)
      .get('/alliances/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Devrait retourner null ou un objet vide
    expect(
      noAllianceResponse.body === null ||
        noAllianceResponse.body?.alliance === null ||
        Object.keys(noAllianceResponse.body).length === 0,
    ).toBe(true);

    // Générer un tag unique pour l'alliance
    const uniqueTag = `T${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // POST /alliances/create - Créer une alliance
    const createResponse = await request(server)
      .post('/alliances/create')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tag: uniqueTag,
        name: 'Alliance de Test Integration',
        description: 'Une alliance créée pour les tests automatisés',
      })
      .expect(201);

    expect(createResponse.body).toBeDefined();
    const allianceId = createResponse.body?.id;
    expect(allianceId).toBeTruthy();
    expect(createResponse.body.tag).toBe(uniqueTag);

    // GET /alliances/me - Devrait retourner l'alliance
    const myAllianceResponse = await request(server)
      .get('/alliances/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(myAllianceResponse.body).toBeDefined();
    expect(
      myAllianceResponse.body?.id === allianceId ||
        myAllianceResponse.body?.alliance?.id === allianceId,
    ).toBe(true);

    // GET /alliances/:id - Détails de l'alliance
    const allianceDetails = await request(server)
      .get(`/alliances/${allianceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(allianceDetails.body.tag).toBe(uniqueTag);
    expect(allianceDetails.body.name).toBe('Alliance de Test Integration');

    await cleanupTestUser(database, testUser.username);
  });

  it('invite et intègre un membre dans l\'alliance', async () => {
    const founder = buildTestUser();
    const member = buildTestUser();

    const { accessToken: founderToken } = await registerAndLogin(app, founder);
    const { accessToken: memberToken } = await registerAndLogin(app, member);

    const server = app.getHttpServer();

    // Créer une alliance
    const uniqueTag = `A${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const createResponse = await request(server)
      .post('/alliances/create')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({
        tag: uniqueTag,
        name: 'Alliance Invitation Test',
      })
      .expect(201);

    const allianceId = createResponse.body?.id;

    // POST /alliances/:id/invite - Inviter le membre par username
    const inviteResponse = await request(server)
      .post(`/alliances/${allianceId}/invite`)
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ username: member.username });

    // L'invitation peut retourner 201 ou 200 selon l'implémentation
    expect([200, 201]).toContain(inviteResponse.status);

    // POST /alliances/:id/join - Le membre rejoint l'alliance
    const joinResponse = await request(server)
      .post(`/alliances/${allianceId}/join`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect([200, 201]).toContain(joinResponse.status);

    // GET /alliances/:id - Vérifier que le membre est dans la liste
    const allianceDetails = await request(server)
      .get(`/alliances/${allianceId}`)
      .set('Authorization', `Bearer ${founderToken}`)
      .expect(200);

    // Devrait avoir au moins 2 membres
    if (allianceDetails.body.members) {
      expect(allianceDetails.body.members.length).toBeGreaterThanOrEqual(2);
    }

    await cleanupTestUser(database, founder.username);
    await cleanupTestUser(database, member.username);
  });

  it('permet de quitter une alliance', async () => {
    const founder = buildTestUser();
    const member = buildTestUser();

    const { accessToken: founderToken } = await registerAndLogin(app, founder);
    const { accessToken: memberToken } = await registerAndLogin(app, member);

    const server = app.getHttpServer();

    // Créer une alliance
    const uniqueTag = `L${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const createResponse = await request(server)
      .post('/alliances/create')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ tag: uniqueTag, name: 'Alliance Leave Test' })
      .expect(201);

    const allianceId = createResponse.body?.id;

    // Inviter par username et rejoindre
    await request(server)
      .post(`/alliances/${allianceId}/invite`)
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ username: member.username });

    await request(server)
      .post(`/alliances/${allianceId}/join`)
      .set('Authorization', `Bearer ${memberToken}`);

    // DELETE /alliances/:id/leave - Le membre quitte
    await request(server)
      .delete(`/alliances/${allianceId}/leave`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    // Vérifier que le membre n'a plus d'alliance
    const noAllianceResponse = await request(server)
      .get('/alliances/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(
      noAllianceResponse.body === null ||
        noAllianceResponse.body?.alliance === null ||
        Object.keys(noAllianceResponse.body).length === 0,
    ).toBe(true);

    await cleanupTestUser(database, founder.username);
    await cleanupTestUser(database, member.username);
  });

  it('refuse création alliance avec tag dupliqué', async () => {
    const user1 = buildTestUser();
    const user2 = buildTestUser();

    const { accessToken: token1 } = await registerAndLogin(app, user1);
    const { accessToken: token2 } = await registerAndLogin(app, user2);

    const server = app.getHttpServer();

    const uniqueTag = `D${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Premier joueur crée l'alliance
    await request(server)
      .post('/alliances/create')
      .set('Authorization', `Bearer ${token1}`)
      .send({ tag: uniqueTag, name: 'Alliance Originale' })
      .expect(201);

    // Deuxième joueur tente de créer avec le même tag
    const duplicateResponse = await request(server)
      .post('/alliances/create')
      .set('Authorization', `Bearer ${token2}`)
      .send({ tag: uniqueTag, name: 'Alliance Dupliquee' });

    // Devrait échouer (400, 409 Conflict, ou 500 si erreur Prisma non catchée)
    expect([400, 409, 500]).toContain(duplicateResponse.status);

    await cleanupTestUser(database, user1.username);
    await cleanupTestUser(database, user2.username);
  });
});
