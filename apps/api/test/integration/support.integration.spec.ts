import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SUPPORT_LIMITS } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp } from './helpers';

/**
 * Support : signalements des joueurs et traitement par les administrateurs.
 */
describe('API integration - Support et signalements de bugs', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const created: string[] = [];

  const server = () => app.getHttpServer();
  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signUp = async (role?: 'ADMIN' | 'PLAYER') => {
    const user = buildTestUser();
    created.push(user.username);
    const res = await request(server()).post('/auth/register').send(user).expect(201);
    const userId = res.body.user.id as string;
    if (role === 'ADMIN') await database.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
    return { user, userId, access: res.body.tokens.accessToken as string };
  };

  const report = (token: string, overrides: Record<string, unknown> = {}) =>
    request(server())
      .post('/support/reports')
      .set(authed(token))
      .set('User-Agent', 'Mozilla/5.0 (test) Chrome/130')
      .send({
        kind: 'bug',
        subject: 'La file de construction se fige',
        body: 'Après avoir lancé une mine de métal, le compte à rebours reste bloqué.',
        pagePath: '/fr/buildings',
        appVersion: 'v0.2.0-alpha.1',
        ...overrides,
      });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const username of created) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  describe('signalement par un joueur', () => {
    it('exige une session', async () => {
      await request(server())
        .post('/support/reports')
        .send({ kind: 'bug', subject: 'Sujet valide', body: 'Un message assez long pour passer' })
        .expect(401);
      await request(server()).get('/support/reports/mine').expect(401);
    });

    it('enregistre le signalement avec son contexte (page, version, navigateur) et le liste au joueur', async () => {
      const { userId, access } = await signUp();
      const res = await report(access).expect(201);
      expect(res.body.id).toEqual(expect.any(String));

      const row = await database.supportReport.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row).toMatchObject({
        userId,
        kind: 'bug',
        status: 'new',
        pagePath: '/fr/buildings',
        appVersion: 'v0.2.0-alpha.1',
        userAgent: 'Mozilla/5.0 (test) Chrome/130',
      });

      const mine = await request(server()).get('/support/reports/mine').set(authed(access)).expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0]).toMatchObject({ id: res.body.id, kind: 'bug', status: 'new' });
      // La liste du joueur ne contient pas le contexte technique
      expect(mine.body[0]).not.toHaveProperty('userAgent');
    });

    it('refuse un type inconnu, un sujet ou un message trop court ou trop long, et les champs inconnus', async () => {
      const { access } = await signUp();
      await report(access, { kind: 'autre' }).expect(400);
      await report(access, { subject: 'a' }).expect(400);
      await report(access, { body: 'court' }).expect(400);
      await report(access, { body: 'x'.repeat(SUPPORT_LIMITS.bodyMax + 1) }).expect(400);
      await report(access, { userId: 'autre-joueur' }).expect(400);
      await report(access, { status: 'resolved' }).expect(400);
      expect(await database.supportReport.count({ where: { user: { username: created[created.length - 1] } } })).toBe(0);
    });

    it('retire les caractères de contrôle du texte', async () => {
      const { access } = await signUp();
      const res = await report(access, { subject: 'Sujet\u0000 propre', body: 'Ligne 1\nLigne 2\u0007 avec contrôle' }).expect(201);
      const row = await database.supportReport.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.subject).toBe('Sujet propre');
      expect(row.body).toBe('Ligne 1\nLigne 2 avec contrôle');
    });

    it('limite les signalements en attente par joueur, même envoyés en parallèle, et libère la place une fois traités', async () => {
      const { userId, access } = await signUp();
      const results = await Promise.all(
        Array.from({ length: SUPPORT_LIMITS.maxOpenPerUser + 3 }, () => report(access)),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(SUPPORT_LIMITS.maxOpenPerUser);
      expect(results.filter((r) => r.status === 409)).toHaveLength(3);
      expect(await database.supportReport.count({ where: { userId } })).toBe(SUPPORT_LIMITS.maxOpenPerUser);

      await database.supportReport.updateMany({ where: { userId }, data: { status: 'resolved' } });
      await report(access).expect(201);
    });
  });

  describe('console d’administration', () => {
    it('est réservée aux administrateurs', async () => {
      const player = await signUp();
      await request(server()).get('/admin/support/reports').expect(401);
      await request(server()).get('/admin/support/reports').set(authed(player.access)).expect(403);
      const made = await report(player.access).expect(201);
      await request(server())
        .patch(`/admin/support/reports/${made.body.id}`)
        .set(authed(player.access))
        .send({ status: 'resolved' })
        .expect(403);
    });

    it('liste avec l’auteur, filtre par statut, traite un signalement et journalise', async () => {
      const player = await signUp();
      const admin = await signUp('ADMIN');
      // Le jeton porte le rôle : se reconnecter après le changement de rôle
      const login = await request(server())
        .post('/auth/login')
        .send({ identifier: admin.user.username, password: admin.user.password })
        .expect(200);
      const adminToken = login.body.tokens.accessToken as string;

      const made = await report(player.access, { kind: 'question', subject: 'Comment attaquer ?' }).expect(201);

      const all = await request(server()).get('/admin/support/reports').set(authed(adminToken)).expect(200);
      const found = all.body.items.find((item: { id: string }) => item.id === made.body.id);
      expect(found).toMatchObject({
        kind: 'question',
        status: 'new',
        user: { id: player.userId, username: player.user.username, email: player.user.email },
      });
      expect(all.body.newCount).toBeGreaterThanOrEqual(1);

      const onlyNew = await request(server()).get('/admin/support/reports?status=new').set(authed(adminToken)).expect(200);
      expect(onlyNew.body.items.every((item: { status: string }) => item.status === 'new')).toBe(true);
      const onlyResolved = await request(server()).get('/admin/support/reports?status=resolved').set(authed(adminToken)).expect(200);
      expect(onlyResolved.body.items.find((item: { id: string }) => item.id === made.body.id)).toBeUndefined();

      await request(server())
        .patch(`/admin/support/reports/${made.body.id}`)
        .set(authed(adminToken))
        .send({ status: 'resolved' })
        .expect(200);
      const row = await database.supportReport.findUniqueOrThrow({ where: { id: made.body.id } });
      expect(row.status).toBe('resolved');
      expect(row.resolvedById).toBe(admin.userId);
      expect(row.resolvedAt).toBeInstanceOf(Date);

      const audit = await database.adminAuditLog.findFirst({
        where: { userId: admin.userId, action: 'support.setStatus' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit?.changes).toEqual({ id: made.body.id, before: 'new', after: 'resolved' });

      // Rouvrir efface la clôture
      await request(server())
        .patch(`/admin/support/reports/${made.body.id}`)
        .set(authed(adminToken))
        .send({ status: 'seen' })
        .expect(200);
      const reopened = await database.supportReport.findUniqueOrThrow({ where: { id: made.body.id } });
      expect(reopened).toMatchObject({ status: 'seen', resolvedAt: null, resolvedById: null });

      // Le joueur voit le statut mis à jour
      const mine = await request(server()).get('/support/reports/mine').set(authed(player.access)).expect(200);
      expect(mine.body[0].status).toBe('seen');
    });

    it('refuse un statut inconnu et un signalement introuvable', async () => {
      const admin = await signUp('ADMIN');
      const login = await request(server())
        .post('/auth/login')
        .send({ identifier: admin.user.username, password: admin.user.password })
        .expect(200);
      const adminToken = login.body.tokens.accessToken as string;
      const player = await signUp();
      const made = await report(player.access).expect(201);

      await request(server())
        .patch(`/admin/support/reports/${made.body.id}`)
        .set(authed(adminToken))
        .send({ status: 'archive' })
        .expect(400);
      await request(server())
        .patch('/admin/support/reports/00000000-0000-4000-8000-000000000000')
        .set(authed(adminToken))
        .send({ status: 'seen' })
        .expect(404);
      await request(server()).patch('/admin/support/reports/pas-un-uuid').set(authed(adminToken)).send({ status: 'seen' }).expect(400);
    });
  });

  it('la suppression du compte efface ses signalements', async () => {
    const { user, userId, access } = await signUp();
    await report(access).expect(201);
    await request(server()).post('/auth/delete-account').set(authed(access)).send({ password: user.password }).expect(200);
    expect(await database.supportReport.count({ where: { userId } })).toBe(0);
  });
});
