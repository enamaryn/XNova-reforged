import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'crypto';
import { DatabaseService } from '../../src/database/database.service';
import {
  acquireGlobalLock,
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';
import { FakeSmtp, extractToken } from './fake-smtp';

/**
 * SCOPE-01 (comptes par email) — vérification d'adresse, mot de passe oublié, réinitialisation,
 * changement de mot de passe et d'adresse : jetons à usage unique, révocation des sessions,
 * aucune fuite d'existence de compte.
 */
describe('API integration - Comptes par email (SCOPE-01)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const smtp = new FakeSmtp();
  const usernames: string[] = [];

  const server = () => app.getHttpServer();
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');

  type Account = {
    username: string;
    email: string;
    password: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
  };

  let smtpEnabled = false;
  const enableSmtp = async () => {
    smtpEnabled = true;
    const values: Record<string, string> = {
      'smtp.enabled': 'true',
      'smtp.host': '127.0.0.1',
      'smtp.port': String(smtp.port),
      'smtp.secure': 'false',
      'smtp.fromEmail': 'jeu@example.test',
      'smtp.fromName': 'XNova',
    };
    for (const [key, value] of Object.entries(values)) {
      await database.gameConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
  };
  const disableSmtp = () => {
    smtpEnabled = false;
    return database.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
  };

  const signUp = async (): Promise<Account> => {
    const user = buildTestUser();
    usernames.push(user.username);
    const res = await request(server()).post('/auth/register').send(user).expect(201);
    // L'email de confirmation part hors de la réponse : on l'attend pour ne pas le confondre avec les suivants
    if (smtpEnabled) await smtp.waitFor(user.email);
    return {
      username: user.username,
      email: user.email,
      password: user.password,
      userId: res.body.user.id,
      accessToken: res.body.tokens.accessToken,
      refreshToken: res.body.tokens.refreshToken,
    };
  };

  const login = async (account: Account, password = account.password) =>
    request(server()).post('/auth/login').send({ identifier: account.username, password });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const NEW_PASSWORD = 'NouveauPass123';

  let releaseLock: () => void = () => undefined;

  beforeAll(async () => {
    // La configuration SMTP est un état global partagé avec l'autre suite SMTP
    releaseLock = await acquireGlobalLock('smtp-config');
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    await smtp.start();
  }, 180_000); // attente possible du verrou des suites SMTP

  beforeEach(async () => {
    smtp.clear();
    await enableSmtp();
  });

  afterAll(async () => {
    await disableSmtp();
    await smtp.stop();
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
    releaseLock();
  });

  // En premier : le compteur de l'adresse IP est encore vide
  describe('limitation de débit', () => {
    it('les routes de compte sont limitées par adresse IP et par email', async () => {
      const previous = process.env.RATE_LIMIT_ACCOUNT_MAX;
      process.env.RATE_LIMIT_ACCOUNT_MAX = '3';
      try {
        const email = `limite_${Date.now()}@example.test`;
        const statuses: number[] = [];
        for (let i = 0; i < 5; i += 1) {
          statuses.push((await request(server()).post('/auth/forgot-password').send({ email })).status);
        }
        expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
        expect(statuses.slice(3)).toEqual([429, 429]);
      } finally {
        process.env.RATE_LIMIT_ACCOUNT_MAX = previous;
      }
    });
  });

  describe('vérification de l\'adresse', () => {
    it('l\'inscription envoie un lien ; le jeton est stocké haché et sert une seule fois', async () => {
      const account = await signUp();
      const mail = await smtp.waitFor(account.email);
      const token = extractToken(mail);
      expect(mail.body).toMatch(/\/verify-email\?token=/);

      const stored = await database.emailToken.findMany({ where: { userId: account.userId } });
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(sha(token));
      expect(JSON.stringify(stored)).not.toContain(token);

      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).emailVerifiedAt).toBeNull();
      const me = await request(server()).get('/auth/me').set(bearer(account.accessToken)).expect(200);
      expect(me.body.emailVerifiedAt).toBeNull();

      const ok = await request(server()).post('/auth/verify-email').send({ token }).expect(200);
      expect(ok.body.type).toBe('verify_email');
      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).emailVerifiedAt).not.toBeNull();
      const verified = await request(server()).get('/auth/me').set(bearer(account.accessToken)).expect(200);
      expect(verified.body.emailVerifiedAt).not.toBeNull();

      await request(server()).post('/auth/verify-email').send({ token }).expect(400);
    });

    it('jeton inconnu, tronqué ou expiré : 400, rien ne change', async () => {
      const account = await signUp();
      const token = extractToken(await smtp.waitFor(account.email));
      await request(server()).post('/auth/verify-email').send({ token: 'x'.repeat(43) }).expect(400);
      await request(server()).post('/auth/verify-email').send({ token: 'court' }).expect(400);

      await database.emailToken.updateMany({
        where: { userId: account.userId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await request(server()).post('/auth/verify-email').send({ token }).expect(400);
      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).emailVerifiedAt).toBeNull();
    });

    it('renvoi : nouveau lien, ancien invalidé ; refusé si déjà confirmé ou sans SMTP', async () => {
      const account = await signUp();
      const first = extractToken(await smtp.waitFor(account.email));
      smtp.clear();

      await request(server()).post('/auth/resend-verification').expect(401);
      await request(server()).post('/auth/resend-verification').set(bearer(account.accessToken)).expect(200);
      const second = extractToken(await smtp.waitFor(account.email));
      expect(second).not.toBe(first);
      await request(server()).post('/auth/verify-email').send({ token: first }).expect(400);

      await disableSmtp();
      await request(server()).post('/auth/resend-verification').set(bearer(account.accessToken)).expect(503);
      await enableSmtp();

      await request(server()).post('/auth/verify-email').send({ token: second }).expect(200);
      await request(server()).post('/auth/resend-verification').set(bearer(account.accessToken)).expect(400);
    });

    it('l\'inscription réussit sans SMTP configuré', async () => {
      await disableSmtp();
      const account = await signUp();
      expect(account.accessToken).toBeTruthy();
      expect(await database.emailToken.count({ where: { userId: account.userId } })).toBe(0);
    });
  });

  describe('mot de passe oublié', () => {
    it('réponse identique pour un compte existant et inconnu ; email seulement pour le compte réel', async () => {
      const account = await signUp();
      await smtp.waitFor(account.email); // email de vérification
      smtp.clear();

      const known = await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
      const unknown = await request(server())
        .post('/auth/forgot-password')
        .send({ email: 'inconnu-xyz@example.test' })
        .expect(200);
      expect(unknown.body).toEqual(known.body);

      const mail = await smtp.waitFor(account.email);
      expect(mail.body).toMatch(/\/reset-password\?token=/);
      expect(await smtp.expectNone('inconnu-xyz@example.test')).toBe(true);

      const row = await database.emailToken.findFirstOrThrow({
        where: { userId: account.userId, type: 'reset_password' },
      });
      expect(row.tokenHash).toBe(sha(extractToken(mail)));
      expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('adresse retrouvée sans tenir compte de la casse ; entrée invalide refusée', async () => {
      const account = await signUp();
      await smtp.waitFor(account.email);
      smtp.clear();
      await request(server()).post('/auth/forgot-password').send({ email: account.email.toUpperCase() }).expect(200);
      await smtp.waitFor(account.email);
      await request(server()).post('/auth/forgot-password').send({ email: 'pas-un-email' }).expect(400);
      await request(server()).post('/auth/forgot-password').send({}).expect(400);
    });

    it('sans SMTP : même réponse, aucun plantage', async () => {
      const account = await signUp();
      await disableSmtp();
      smtp.clear();
      await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
      expect(await smtp.expectNone(account.email)).toBe(true);
    });

    it('une nouvelle demande invalide le lien précédent', async () => {
      const account = await signUp();
      await smtp.waitFor(account.email);
      smtp.clear();
      await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
      const first = extractToken(await smtp.waitFor(account.email));
      smtp.clear();
      await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
      const second = extractToken(await smtp.waitFor(account.email));
      expect(second).not.toBe(first);

      await request(server()).post('/auth/reset-password').send({ token: first, password: NEW_PASSWORD }).expect(400);
      await request(server()).post('/auth/reset-password').send({ token: second, password: NEW_PASSWORD }).expect(200);
    });
  });

  describe('réinitialisation', () => {
    const requestReset = async (account: Account) => {
      smtp.clear();
      await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
      return extractToken(await smtp.waitFor(account.email));
    };

    it('change le mot de passe, révoque toutes les sessions, usage unique', async () => {
      const account = await signUp();
      const other = (await login(account)).body.tokens;
      const token = await requestReset(account);

      await request(server()).post('/auth/reset-password').send({ token, password: NEW_PASSWORD }).expect(200);

      expect((await login(account)).status).toBe(401);
      expect((await login(account, NEW_PASSWORD)).status).toBe(200);
      // Anciennes sessions : jeton d'accès et rafraîchissement refusés
      await request(server()).get('/auth/me').set(bearer(account.accessToken)).expect(401);
      await request(server()).get('/auth/me').set(bearer(other.accessToken)).expect(401);
      await request(server()).post('/auth/refresh').send({ refreshToken: other.refreshToken }).expect(401);

      await request(server()).post('/auth/reset-password').send({ token, password: 'Autre12345Pass' }).expect(400);
      expect((await login(account, NEW_PASSWORD)).status).toBe(200);
    });

    it('deux demandes simultanées avec le même jeton : une seule réussit', async () => {
      const account = await signUp();
      const token = await requestReset(account);
      const results = await Promise.all([
        request(server()).post('/auth/reset-password').send({ token, password: NEW_PASSWORD }),
        request(server()).post('/auth/reset-password').send({ token, password: 'Concurrent123Pass' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    });

    it('refuse un jeton expiré, inconnu, d\'un autre type ou un mot de passe faible, sans rien changer', async () => {
      const account = await signUp();
      const verifyToken = extractToken(await smtp.waitFor(account.email));
      const token = await requestReset(account);

      await request(server()).post('/auth/reset-password').send({ token: 'z'.repeat(43), password: NEW_PASSWORD }).expect(400);
      // Un jeton de vérification ne réinitialise pas un mot de passe
      await request(server()).post('/auth/reset-password').send({ token: verifyToken, password: NEW_PASSWORD }).expect(400);
      // Mot de passe trop faible : refusé avant de consommer le jeton
      await request(server()).post('/auth/reset-password').send({ token, password: 'faible' }).expect(400);
      expect((await database.emailToken.findFirstOrThrow({ where: { tokenHash: sha(token) } })).usedAt).toBeNull();

      await database.emailToken.updateMany({
        where: { tokenHash: sha(token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await request(server()).post('/auth/reset-password').send({ token, password: NEW_PASSWORD }).expect(400);
      expect((await login(account)).status).toBe(200);
    });

    it('un jeton de réinitialisation ne confirme pas une adresse', async () => {
      const account = await signUp();
      const token = await requestReset(account);
      await request(server()).post('/auth/verify-email').send({ token }).expect(400);
      expect((await database.emailToken.findFirstOrThrow({ where: { tokenHash: sha(token) } })).usedAt).toBeNull();
    });
  });

  describe('changement de mot de passe', () => {
    const change = (account: Account, body: Record<string, unknown>) =>
      request(server()).post('/auth/change-password').set(bearer(account.accessToken)).send(body);

    it('exige l\'authentification, le bon mot de passe actuel et une règle valide', async () => {
      const account = await signUp();
      await request(server()).post('/auth/change-password').send({}).expect(401);
      await change(account, { currentPassword: 'Mauvais12345', newPassword: NEW_PASSWORD }).expect(401);
      await change(account, { currentPassword: account.password, newPassword: 'faible' }).expect(400);
      await change(account, { currentPassword: account.password, newPassword: account.password }).expect(400);
      expect((await login(account)).status).toBe(200);
    });

    it('change le mot de passe, révoque les autres sessions et garde la session courante', async () => {
      const account = await signUp();
      const other = (await login(account)).body.tokens;

      await change(account, { currentPassword: account.password, newPassword: NEW_PASSWORD }).expect(200);

      expect((await login(account)).status).toBe(401);
      expect((await login(account, NEW_PASSWORD)).status).toBe(200);
      // Session courante conservée
      await request(server()).get('/auth/me').set(bearer(account.accessToken)).expect(200);
      // Autre appareil : accès et rafraîchissement refusés
      await request(server()).get('/auth/me').set(bearer(other.accessToken)).expect(401);
      await request(server()).post('/auth/refresh').send({ refreshToken: other.refreshToken }).expect(401);
    });

    it('invalide les liens de réinitialisation déjà envoyés', async () => {
      const account = await signUp();
      await smtp.waitFor(account.email);
      smtp.clear();
      await request(server()).post('/auth/forgot-password').send({ email: account.email }).expect(200);
      const token = extractToken(await smtp.waitFor(account.email));
      await change(account, { currentPassword: account.password, newPassword: NEW_PASSWORD }).expect(200);
      await request(server()).post('/auth/reset-password').send({ token, password: 'Autre12345Pass' }).expect(400);
    });
  });

  describe('changement d\'adresse email', () => {
    const changeEmail = (account: Account, body: Record<string, unknown>) =>
      request(server()).post('/auth/change-email').set(bearer(account.accessToken)).send(body);

    it('exige l\'authentification et le mot de passe ; refuse adresse identique, invalide ou déjà prise', async () => {
      const account = await signUp();
      const rival = await signUp();
      await request(server()).post('/auth/change-email').send({}).expect(401);
      await changeEmail(account, { currentPassword: 'Mauvais12345', newEmail: 'neuf@example.test' }).expect(401);
      await changeEmail(account, { currentPassword: account.password, newEmail: account.email }).expect(400);
      await changeEmail(account, { currentPassword: account.password, newEmail: 'pas-un-email' }).expect(400);
      await changeEmail(account, { currentPassword: account.password, newEmail: rival.email.toUpperCase() }).expect(409);
      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).email).toBe(account.email);
    });

    it('l\'adresse ne change qu\'après confirmation depuis la nouvelle ; alerte l\'ancienne', async () => {
      const account = await signUp();
      await smtp.waitFor(account.email);
      smtp.clear();
      const newEmail = `nouvelle_${account.username}@example.test`;

      await changeEmail(account, { currentPassword: account.password, newEmail }).expect(200);
      const confirmation = await smtp.waitFor(newEmail);
      const notice = await smtp.waitFor(account.email);
      expect(notice.body).toContain(newEmail);
      expect(notice.body).not.toMatch(/token=/);

      // Avant confirmation : rien ne change
      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).email).toBe(account.email);

      const token = extractToken(confirmation);
      const res = await request(server()).post('/auth/verify-email').send({ token }).expect(200);
      expect(res.body.type).toBe('change_email');

      const user = await database.user.findUniqueOrThrow({ where: { id: account.userId } });
      expect(user.email).toBe(newEmail);
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(
        (await request(server()).post('/auth/login').send({ identifier: newEmail, password: account.password })).status,
      ).toBe(200);
      await request(server()).post('/auth/verify-email').send({ token }).expect(400);
    });

    it('adresse prise entre la demande et la confirmation : 409, adresse inchangée', async () => {
      const account = await signUp();
      const rival = await signUp();
      await smtp.waitFor(account.email);
      const newEmail = `course_${account.username}@example.test`;
      await changeEmail(account, { currentPassword: account.password, newEmail }).expect(200);
      const token = extractToken(await smtp.waitFor(newEmail));

      await database.user.update({ where: { id: rival.userId }, data: { email: newEmail } });
      await request(server()).post('/auth/verify-email').send({ token }).expect(409);
      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).email).toBe(account.email);
    });

    it('un jeton de vérification émis pour l\'ancienne adresse ne vaut plus après changement', async () => {
      const account = await signUp();
      const verifyToken = extractToken(await smtp.waitFor(account.email));
      await database.user.update({
        where: { id: account.userId },
        data: { email: `autre_${account.username}@example.test` },
      });
      await request(server()).post('/auth/verify-email').send({ token: verifyToken }).expect(400);
    });

    it('sans SMTP : 503 et aucune demande enregistrée', async () => {
      const account = await signUp();
      await disableSmtp();
      await changeEmail(account, { currentPassword: account.password, newEmail: `x_${account.username}@example.test` }).expect(503);
      expect((await database.user.findUniqueOrThrow({ where: { id: account.userId } })).email).toBe(account.email);
    });
  });

  it('registerAndLogin reste compatible (compte créé et connecté)', async () => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    expect(accessToken).toBeTruthy();
  });
});
