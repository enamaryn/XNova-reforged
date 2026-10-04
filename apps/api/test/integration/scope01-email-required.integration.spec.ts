import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { acquireGlobalLock, buildTestUser, cleanupTestUser, createIntegrationApp } from './helpers';
import { FakeSmtp, extractToken } from './fake-smtp';

/**
 * SCOPE-01 — la confirmation de l'adresse email est obligatoire pour créer un compte :
 * inscription sans session, connexion refusée tant que l'adresse n'est pas confirmée,
 * renvoi public du lien, aucune inscription possible sans moyen d'envoyer l'email.
 */
describe('API integration - Confirmation d\'email obligatoire (SCOPE-01)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const smtp = new FakeSmtp();
  const usernames: string[] = [];
  let releaseLock: () => void = () => undefined;
  const previousFlag = process.env.EMAIL_VERIFICATION_REQUIRED;

  const server = () => app.getHttpServer();

  const enableSmtp = async () => {
    const values: Record<string, string> = {
      'smtp.enabled': 'true',
      'smtp.host': '127.0.0.1',
      'smtp.port': String(smtp.port),
      'smtp.secure': 'false',
      'smtp.fromEmail': 'jeu@example.test',
    };
    for (const [key, value] of Object.entries(values)) {
      await database.gameConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
  };
  const disableSmtp = () => database.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });

  const register = async () => {
    const user = buildTestUser();
    usernames.push(user.username);
    const res = await request(server()).post('/auth/register').send(user);
    return { user, res };
  };
  const login = (user: { username: string; password: string }, password = user.password) =>
    request(server()).post('/auth/login').send({ identifier: user.username, password });

  beforeAll(async () => {
    releaseLock = await acquireGlobalLock('smtp-config');
    await smtp.start();
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    process.env.EMAIL_VERIFICATION_REQUIRED = 'true';
  }, 180_000); // attente possible du verrou des suites SMTP

  beforeEach(async () => {
    smtp.clear();
    await enableSmtp();
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.EMAIL_VERIFICATION_REQUIRED;
    else process.env.EMAIL_VERIFICATION_REQUIRED = previousFlag;
    await disableSmtp();
    await smtp.stop();
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
    releaseLock();
  });

  it('sans envoi d\'emails possible : inscription refusée (503), aucun compte créé', async () => {
    await disableSmtp();
    const { user, res } = await register();
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/indisponibles/);
    expect(await database.user.count({ where: { username: user.username } })).toBe(0);
  });

  it('l\'inscription crée le compte sans session et envoie le lien de confirmation', async () => {
    const { user, res } = await register();
    expect(res.status).toBe(201);
    expect(res.body.verificationRequired).toBe(true);
    expect(res.body.tokens).toBeUndefined();
    expect(res.body.user).toMatchObject({ username: user.username, email: user.email });

    const row = await database.user.findUniqueOrThrow({ where: { username: user.username } });
    expect(row.emailVerifiedAt).toBeNull();
    expect(await database.session.count({ where: { userId: row.id } })).toBe(0);

    const mail = await smtp.waitFor(user.email);
    expect(mail.body).toMatch(/\/verify-email\?token=/);
  });

  it('connexion refusée tant que l\'adresse n\'est pas confirmée ; mot de passe faux : rien de révélé', async () => {
    const { user } = await register();
    const refused = await login(user);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(refused.body.message).toMatch(/non confirmée/);
    expect(refused.body.tokens).toBeUndefined();

    const wrong = await login(user, 'Mauvais12345');
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBeUndefined();
  });

  it('après confirmation par le lien, la connexion fonctionne', async () => {
    const { user } = await register();
    const token = extractToken(await smtp.waitFor(user.email));
    await request(server()).post('/auth/verify-email').send({ token }).expect(200);

    const ok = await login(user);
    expect(ok.status).toBe(200);
    expect(ok.body.tokens.accessToken).toBeTruthy();
    await request(server())
      .get('/auth/me')
      .set({ Authorization: `Bearer ${ok.body.tokens.accessToken}` })
      .expect(200);
  });

  it('renvoi public : même réponse pour tous ; email seulement pour un compte non confirmé ; ancien lien invalidé', async () => {
    const { user } = await register();
    const first = extractToken(await smtp.waitFor(user.email));
    smtp.clear();

    const unknown = await request(server()).post('/auth/resend-confirmation').send({ email: 'inconnu-abc@example.test' }).expect(200);
    const known = await request(server()).post('/auth/resend-confirmation').send({ email: user.email }).expect(200);
    expect(unknown.body).toEqual(known.body);

    const second = extractToken(await smtp.waitFor(user.email));
    expect(second).not.toBe(first);
    expect(await smtp.expectNone('inconnu-abc@example.test')).toBe(true);
    await request(server()).post('/auth/verify-email').send({ token: first }).expect(400);
    await request(server()).post('/auth/verify-email').send({ token: second }).expect(200);

    // Compte déjà confirmé : aucun nouvel email
    smtp.clear();
    await request(server()).post('/auth/resend-confirmation').send({ email: user.email }).expect(200);
    expect(await smtp.expectNone(user.email)).toBe(true);
    await request(server()).post('/auth/resend-confirmation').send({ email: 'pas-un-email' }).expect(400);
  });

  it('un compte repris (adresse déjà marquée confirmée) se connecte normalement', async () => {
    const { user } = await register();
    await database.user.update({ where: { username: user.username }, data: { emailVerifiedAt: new Date() } });
    expect((await login(user)).status).toBe(200);
  });

  it('désactivé explicitement (EMAIL_VERIFICATION_REQUIRED=false) : inscription avec session, comme avant', async () => {
    process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
    try {
      await disableSmtp();
      const { res } = await register();
      expect(res.status).toBe(201);
      expect(res.body.tokens.accessToken).toBeTruthy();
      expect(res.body.verificationRequired).toBeUndefined();
    } finally {
      process.env.EMAIL_VERIFICATION_REQUIRED = 'true';
    }
  });
});
