import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * OPS-03 : refus d'accès interjoueur. Un joueur B tente, avec son propre jeton, de lire ou modifier
 * les ressources, bâtiments, files, chantier, flottes et messages du joueur A. Chaque tentative doit être
 * refusée et l'état de A doit rester identique.
 */
describe('API integration - refus d\'accès interjoueur (OPS-03)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  let tokenA: string;
  let tokenB: string;
  let planetA: string;
  let planetB: string;
  let buildQueueIdA: string;
  let messageIdA: string;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;

    const a = buildTestUser();
    const b = buildTestUser();
    users.push(a, b);
    tokenA = (await registerAndLogin(app, a)).accessToken;
    tokenB = (await registerAndLogin(app, b)).accessToken;

    const server = app.getHttpServer();
    const meA = await request(server).get('/auth/me').set(as(tokenA)).expect(200);
    const meB = await request(server).get('/auth/me').set(as(tokenB)).expect(200);
    planetA = meA.body.planets[0].id;
    planetB = meB.body.planets[0].id;

    const build = await request(server)
      .post(`/planets/${planetA}/build`)
      .set(as(tokenA))
      .send({ buildingId: 1 })
      .expect(201);
    buildQueueIdA = build.body.id;

    // Message reçu par A, envoyé par B (A est le destinataire, B ne doit pas pouvoir le supprimer en tant que A)
    const third = buildTestUser();
    users.push(third);
    const tokenC = (await registerAndLogin(app, third)).accessToken;
    await request(server)
      .post('/messages/send')
      .set(as(tokenC))
      .send({ toUsername: a.username, subject: 'Privé', body: 'Contenu privé de A' })
      .expect(201);
    const inbox = await request(server).get('/messages/inbox').set(as(tokenA)).expect(200);
    messageIdA = inbox.body[0].id;
  });

  afterAll(async () => {
    for (const user of users) {
      await cleanupTestUser(database, user.username);
    }
    if (app) await app.close();
  });

  const snapshotA = async () => {
    const planet = await database.planet.findUnique({ where: { id: planetA } });
    const [builds, research, ships, messages] = await Promise.all([
      database.buildQueue.count({ where: { planetId: planetA } }),
      database.researchQueue.count({ where: { userId: planet!.userId } }),
      database.shipQueue.count({ where: { planetId: planetA } }),
      database.message.count({ where: { toId: planet!.userId } }),
    ]);
    return {
      name: planet!.name,
      metal: planet!.metal,
      crystal: planet!.crystal,
      deuterium: planet!.deuterium,
      builds,
      research,
      ships,
      messages,
    };
  };

  it('refuse à B toute lecture ou écriture sur la planète et les files de A', async () => {
    const server = app.getHttpServer();
    const before = await snapshotA();

    const attempts: Array<[string, () => request.Test]> = [
      ['GET planète', () => request(server).get(`/planets/${planetA}`)],
      ['GET ressources', () => request(server).get(`/planets/${planetA}/resources`)],
      ['PUT renommer', () => request(server).put(`/planets/${planetA}`).send({ name: 'Piratée' })],
      ['GET bâtiments', () => request(server).get(`/planets/${planetA}/buildings`)],
      ['POST construire', () => request(server).post(`/planets/${planetA}/build`).send({ buildingId: 2 })],
      ['GET file de construction', () => request(server).get(`/planets/${planetA}/build-queue`)],
      ['DELETE annuler la construction de A', () => request(server).delete(`/planets/${planetA}/build-queue/${buildQueueIdA}`)],
      ['DELETE annuler via sa propre planète', () => request(server).delete(`/planets/${planetB}/build-queue/${buildQueueIdA}`)],
      ['GET technologies', () => request(server).get(`/technologies?planetId=${planetA}`)],
      ['POST rechercher depuis la planète de A', () => request(server).post('/research').send({ planetId: planetA, techId: 113 })],
      ['GET chantier', () => request(server).get(`/shipyard?planetId=${planetA}`)],
      ['GET file du chantier', () => request(server).get(`/shipyard/queue?planetId=${planetA}`)],
      ['POST vaisseau', () => request(server).post('/shipyard/build').send({ planetId: planetA, shipId: 202, amount: 1 })],
      ['GET défenses', () => request(server).get(`/defense?planetId=${planetA}`)],
      ['POST défense', () => request(server).post('/defense/build').send({ planetId: planetA, defenseId: 401, amount: 1 })],
      ['GET flotte disponible', () => request(server).get(`/fleet/available/${planetA}`)],
      [
        'POST envoyer une flotte depuis la planète de A',
        () =>
          request(server)
            .post('/fleet/send')
            .send({ planetId: planetA, toGalaxy: 1, toSystem: 1, toPosition: 1, mission: 3, speedPercent: 100, ships: { 202: 1 } }),
      ],
      ['GET message de A', () => request(server).get(`/messages/${messageIdA}`)],
      ['DELETE message de A', () => request(server).delete(`/messages/${messageIdA}`)],
    ];

    const results: string[] = [];
    for (const [label, build] of attempts) {
      const res = await build().set(as(tokenB));
      results.push(`${label}: ${res.status}`);
      // Planète d'autrui : 403 ; file ou message d'autrui : 404 (pas d'énumération des identifiants)
      expect(res.status).toBe(/annuler|message/.test(label) ? 404 : 403);
      expect(JSON.stringify(res.body)).not.toContain('Contenu privé de A');
    }
    expect(results).toHaveLength(attempts.length);

    expect(await snapshotA()).toEqual(before);
  });

  it('refuse sans jeton et avec un jeton invalide', async () => {
    const server = app.getHttpServer();
    for (const path of [`/planets/${planetA}`, `/planets/${planetA}/resources`, '/messages/inbox', '/research-queue']) {
      await request(server).get(path).expect(401);
      await request(server).get(path).set('Authorization', 'Bearer jeton.invalide.xyz').expect(401);
    }
  });

  it('A conserve son accès à ses propres données', async () => {
    const server = app.getHttpServer();
    await request(server).get(`/planets/${planetA}/resources`).set(as(tokenA)).expect(200);
    await request(server).get(`/planets/${planetA}/build-queue`).set(as(tokenA)).expect(200);
    await request(server).get(`/messages/${messageIdA}`).set(as(tokenA)).expect(200);
  });
});
