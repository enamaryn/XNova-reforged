import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { SetupDb, resetSetup } from '../../src/setup/setup-core';
import { createIntegrationApp, useIsolatedSchema } from './helpers';
import { FakeSmtp, extractToken } from './fake-smtp';

/**
 * SETUP-01 — parcours d'installation du serveur : code d'installation lu dans le terminal, SMTP testé, réglages,
 * super admin à confirmer par email, clôture et verrouillage définitifs, réarmement par commande terminal.
 *
 * Schéma PostgreSQL dédié : l'état « installation en cours » est global à la base et fermerait les inscriptions
 * des autres suites qui tournent en parallèle.
 */
describe('API integration - Parcours d\'installation du serveur (SETUP-01)', () => {
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;
  const originalEnv = { ...process.env };
  const smtp = new FakeSmtp();
  const FIXED = 'code-de-test-setup-1';

  let app: INestApplication;
  let database: DatabaseService;
  const server = () => app.getHttpServer();
  // Le semis de la galaxie crée l'utilisateur système « __abandoned__ » : ce n'est pas un joueur
  const players = () => database.user.count({ where: { username: { not: '__abandoned__' } } });
  const asSetup = (token = FIXED) => ({ 'x-setup-token': token });

  const smtpBody = () => ({
    host: '127.0.0.1',
    port: smtp.port,
    secure: false,
    username: 'mailer',
    password: 'secret-smtp-123',
    fromEmail: 'jeu@example.test',
    fromName: 'XNova',
  });
  const adminBody = (suffix = 'a') => ({
    username: `owner_${suffix}`,
    email: `owner_${suffix}@example.test`,
    password: 'Proprietaire123',
  });

  const start = async (fixedToken?: string) => {
    if (fixedToken) process.env.SETUP_TOKEN = fixedToken;
    else delete process.env.SETUP_TOKEN;
    const integration = await createIntegrationApp({ setupCompleted: false });
    app = integration.app;
    database = integration.database;
  };

  beforeAll(async () => {
    isolated = await useIsolatedSchema('setup_it');
    process.env.EMAIL_VERIFICATION_REQUIRED = 'true';
    await smtp.start();
  }, 120_000);

  afterAll(async () => {
    try {
      if (app) await app.close();
      await smtp.stop();
    } finally {
      await isolated?.drop();
      process.env = originalEnv;
    }
  });

  describe('code d\'installation', () => {
    it('est affiché dans le terminal au démarrage, fonctionne, et change à chaque redémarrage', async () => {
      const logs: string[] = [];
      const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });
      await start(); // sans SETUP_TOKEN : code aléatoire
      spy.mockRestore();

      const banner = logs.find((line) => line.includes("Code d'installation"));
      expect(banner).toBeDefined();
      const shown = banner!.match(/Code d'installation : ([A-Z0-9-]+)/)![1];
      expect(shown).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
      expect(banner).toContain('/setup');

      await request(server()).get('/setup/state').set(asSetup(shown)).expect(200);
      await request(server()).get('/setup/state').set(asSetup(shown.toLowerCase().replace(/-/g, ' '))).expect(200);
      await app.close();

      // Redémarrage avec un code fixé (automatisation) : l'ancien code est invalide
      await start(FIXED);
      await request(server()).get('/setup/state').set(asSetup(shown)).expect(401);
      await request(server()).get('/setup/state').set(asSetup()).expect(200);
    }, 60_000);

    it('statut public ; routes protégées sans ou avec un mauvais code : 401 ; inscriptions fermées', async () => {
      const status = await request(server()).get('/setup/status').expect(200);
      expect(status.body).toEqual({ setupRequired: true });

      for (const call of [
        () => request(server()).get('/setup/state'),
        () => request(server()).put('/setup/smtp').send(smtpBody()),
        () => request(server()).post('/setup/smtp/test').send({ to: 'x@example.test' }),
        () => request(server()).put('/setup/settings').send({ gameSpeed: 5 }),
        () => request(server()).post('/setup/admin').send(adminBody()),
        () => request(server()).post('/setup/admin/resend'),
      ]) {
        expect((await call()).status).toBe(401);
      }
      await request(server()).get('/setup/state').set(asSetup('mauvais-code')).expect(401);

      const reg = await request(server())
        .post('/auth/register')
        .send({ username: 'curieux', email: 'curieux@example.test', password: 'Test1234!' });
      expect(reg.status).toBe(503);
      expect(reg.body.message).toMatch(/pas encore configuré/);
      expect(await players()).toBe(0);
    });

    it('un code expiré est refusé', async () => {
      await database.gameConfig.update({
        where: { key: 'setup.tokenExpiresAt' },
        data: { value: new Date(Date.now() - 1000).toISOString() },
      });
      await request(server()).get('/setup/state').set(asSetup()).expect(401);
      // Nouveau code (équivalent de `npm run setup:token`) : valide aussitôt
      const fresh = await (await import('../../src/setup/setup-core')).issueSetupToken(database as unknown as SetupDb);
      await request(server()).get('/setup/state').set(asSetup(fresh)).expect(200);
      await (await import('../../src/setup/setup-core')).issueSetupToken(database as unknown as SetupDb, {
        fixedToken: FIXED,
      });
    });
  });

  describe('SMTP', () => {
    it('état initial : rien de fait', async () => {
      const res = await request(server()).get('/setup/state').set(asSetup()).expect(200);
      expect(res.body).toMatchObject({
        completed: false,
        smtp: { configured: false, tested: false },
        settings: { saved: false },
        admin: null,
      });
    });

    it('le compte super admin exige un envoi d\'email testé', async () => {
      const res = await request(server()).post('/setup/admin').set(asSetup()).send(adminBody()).expect(409);
      expect(res.body.message).toMatch(/Testez d'abord/);
      expect(await players()).toBe(0);
    });

    it('refuse les valeurs invalides ; enregistre sans jamais renvoyer le mot de passe', async () => {
      await request(server()).put('/setup/smtp').set(asSetup()).send({ port: 0 }).expect(400);
      await request(server()).put('/setup/smtp').set(asSetup()).send({ host: 'sans espace ; non' }).expect(400);
      await request(server()).put('/setup/smtp').set(asSetup()).send({ fromEmail: 'pas-un-email' }).expect(400);
      await request(server()).put('/setup/smtp').set(asSetup()).send({ port: 587 }).expect(400); // hôte requis

      const res = await request(server()).put('/setup/smtp').set(asSetup()).send(smtpBody()).expect(200);
      expect(res.body.smtp).toMatchObject({ configured: true, tested: false, host: '127.0.0.1', passwordSet: true });
      expect(JSON.stringify(res.body)).not.toContain('secret-smtp-123');
      const stored = await database.gameConfig.findUniqueOrThrow({ where: { key: 'smtp.password' } });
      expect(stored.value.startsWith('enc:v1:')).toBe(true);
    });

    it('l\'envoi de test part réellement ; modifier la connexion invalide le test', async () => {
      await request(server()).post('/setup/smtp/test').set(asSetup()).send({ to: 'pas-un-email' }).expect(400);
      const ok = await request(server())
        .post('/setup/smtp/test')
        .set(asSetup())
        .send({ to: 'prop@example.test' })
        .expect(200);
      expect(ok.body).toEqual({ success: true, to: 'prop@example.test' });
      const mail = await smtp.waitFor('prop@example.test');
      expect(mail.body).toMatch(/envoi d'emails du serveur fonctionne/);
      expect((await request(server()).get('/setup/state').set(asSetup())).body.smtp.tested).toBe(true);

      // Changement de serveur : le test doit être refait
      await request(server()).put('/setup/smtp').set(asSetup()).send({ port: smtp.port + 0, fromName: 'Autre' }).expect(200);
      expect((await request(server()).get('/setup/state').set(asSetup())).body.smtp.tested).toBe(false);
      await request(server()).post('/setup/smtp/test').set(asSetup()).send({ to: 'prop@example.test' }).expect(200);
      expect((await request(server()).get('/setup/state').set(asSetup())).body.smtp.tested).toBe(true);
    });

    it('serveur injoignable : erreur lisible, test non validé, aucun secret renvoyé', async () => {
      await request(server()).put('/setup/smtp').set(asSetup()).send({ port: 1 }).expect(200);
      const res = await request(server()).post('/setup/smtp/test').set(asSetup()).send({ to: 'prop@example.test' }).expect(400);
      expect(res.body.message).toMatch(/Échec de l'envoi/);
      expect(JSON.stringify(res.body)).not.toContain('secret-smtp-123');
      expect((await request(server()).get('/setup/state').set(asSetup())).body.smtp.tested).toBe(false);
      // Retour à la bonne configuration
      await request(server()).put('/setup/smtp').set(asSetup()).send({ port: smtp.port }).expect(200);
      await request(server()).post('/setup/smtp/test').set(asSetup()).send({ to: 'prop@example.test' }).expect(200);
    });
  });

  describe('réglages du serveur', () => {
    it('refuse les valeurs invalides ; applique les valeurs valides sans journal d\'audit (aucun compte)', async () => {
      await request(server()).put('/setup/settings').set(asSetup()).send({ gameSpeed: -1 }).expect(400);
      await request(server()).put('/setup/settings').set(asSetup()).send({ planetSize: 5 }).expect(400);
      await request(server()).put('/setup/settings').set(asSetup()).send({ inconnu: 1 }).expect(400);

      const res = await request(server())
        .put('/setup/settings')
        .set(asSetup())
        .send({ gameSpeed: 10, fleetSpeed: 5, resourceMultiplier: 2 })
        .expect(200);
      expect(res.body.settings.saved).toBe(true);
      expect(res.body.settings.values).toMatchObject({ gameSpeed: 10, fleetSpeed: 5, resourceMultiplier: 2 });
      expect((await database.gameConfig.findUniqueOrThrow({ where: { key: 'gameSpeed' } })).value).toBe('10');
      expect(await database.adminAuditLog.count()).toBe(0);
    });

    it('valider sans rien changer marque tout de même l\'étape comme faite', async () => {
      const res = await request(server()).put('/setup/settings').set(asSetup()).send({}).expect(200);
      expect(res.body.settings.saved).toBe(true);
    });
  });

  describe('super admin et clôture', () => {
    it('refuse un mot de passe faible ; crée le compte, envoie le lien, ferme toujours les inscriptions', async () => {
      await request(server()).post('/setup/admin').set(asSetup()).send({ ...adminBody(), password: 'faible' }).expect(400);
      smtp.clear();
      const res = await request(server()).post('/setup/admin').set(asSetup()).send(adminBody('a')).expect(200);
      expect(res.body.admin).toEqual({ username: 'owner_a', email: 'owner_a@example.test', verified: false });

      const user = await database.user.findUniqueOrThrow({ where: { username: 'owner_a' } });
      expect(user.role).toBe('SUPER_ADMIN');
      expect(user.emailVerifiedAt).toBeNull();
      expect(await database.planet.count({ where: { userId: user.id } })).toBe(1);

      const mail = await smtp.waitFor('owner_a@example.test');
      expect(mail.body).toMatch(/\/verify-email\?token=/);

      // Connexion refusée tant que l'adresse n'est pas confirmée ; inscriptions toujours fermées
      const login = await request(server()).post('/auth/login').send({ identifier: 'owner_a', password: 'Proprietaire123' });
      expect(login.status).toBe(403);
      const reg = await request(server())
        .post('/auth/register')
        .send({ username: 'autre', email: 'autre@example.test', password: 'Test1234!' });
      expect(reg.status).toBe(503);
    });

    it('un compte non confirmé est remplacé (faute de frappe) ; l\'ancien lien devient invalide', async () => {
      const oldToken = extractToken(await smtp.waitFor('owner_a@example.test'));
      smtp.clear();
      const res = await request(server()).post('/setup/admin').set(asSetup()).send(adminBody('b')).expect(200);
      expect(res.body.admin.username).toBe('owner_b');
      expect(await database.user.count({ where: { username: 'owner_a' } })).toBe(0);
      expect(await database.user.count({ where: { role: 'SUPER_ADMIN' } })).toBe(1);
      await request(server()).post('/auth/verify-email').send({ token: oldToken }).expect(400);
    });

    it('renvoi du lien : nouveau lien, ancien invalidé', async () => {
      const first = extractToken(await smtp.waitFor('owner_b@example.test'));
      smtp.clear();
      await request(server()).post('/setup/admin/resend').set(asSetup()).expect(200);
      const second = extractToken(await smtp.waitFor('owner_b@example.test'));
      expect(second).not.toBe(first);
      await request(server()).post('/auth/verify-email').send({ token: first }).expect(400);
    });

    it('le clic sur le lien confirme le compte, termine l\'installation et verrouille le parcours', async () => {
      const token = extractToken(await smtp.waitFor('owner_b@example.test'));
      await request(server()).post('/auth/verify-email').send({ token }).expect(200);

      expect((await request(server()).get('/setup/status').expect(200)).body).toEqual({ setupRequired: false });
      expect(await database.gameConfig.findUnique({ where: { key: 'setup.completedAt' } })).not.toBeNull();
      // Code et progression effacés : il ne reste que l'indicateur de fin
      const keys = (await database.gameConfig.findMany({ where: { key: { startsWith: 'setup.' } } })).map((r) => r.key);
      expect(keys).toEqual(['setup.completedAt']);
      expect(await database.adminAuditLog.count({ where: { action: 'setup_complete' } })).toBe(1);

      // Le super admin se connecte
      const login = await request(server()).post('/auth/login').send({ identifier: 'owner_b', password: 'Proprietaire123' });
      expect(login.status).toBe(200);
      expect(login.body.user.role).toBe('SUPER_ADMIN');
    });

    it('après la clôture, toutes les routes du parcours n\'existent plus (404), même avec le bon code', async () => {
      const before = await database.gameConfig.count();
      for (const call of [
        () => request(server()).get('/setup/state').set(asSetup()),
        () => request(server()).put('/setup/smtp').set(asSetup()).send({ host: 'pirate.example.test' }),
        () => request(server()).post('/setup/smtp/test').set(asSetup()).send({ to: 'x@example.test' }),
        () => request(server()).put('/setup/settings').set(asSetup()).send({ gameSpeed: 9999 }),
        () => request(server()).post('/setup/admin').set(asSetup()).send(adminBody('pirate')),
        () => request(server()).post('/setup/admin/resend').set(asSetup()),
      ]) {
        expect((await call()).status).toBe(404);
      }
      expect(await database.user.count({ where: { username: 'owner_pirate' } })).toBe(0);
      expect((await database.gameConfig.findUniqueOrThrow({ where: { key: 'smtp.host' } })).value).toBe('127.0.0.1');
      expect(await database.gameConfig.count()).toBe(before);
    });

    it('les inscriptions rouvrent à la fin de l\'installation', async () => {
      const res = await request(server())
        .post('/auth/register')
        .send({ username: 'joueur1', email: 'joueur1@example.test', password: 'Test1234!' });
      expect(res.status).toBe(201);
      expect(res.body.verificationRequired).toBe(true);
    });

    it('redémarrer l\'API ne rouvre pas le parcours et n\'émet plus de code', async () => {
      const logs: string[] = [];
      const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });
      await app.close();
      await start(FIXED);
      spy.mockRestore();
      expect(logs.some((line) => line.includes("Code d'installation"))).toBe(false);
      expect((await request(server()).get('/setup/status')).body).toEqual({ setupRequired: false });
      await request(server()).get('/setup/state').set(asSetup()).expect(404);
    }, 60_000);
  });

  describe('réarmement par commande terminal', () => {
    it('setup:reset rouvre le parcours avec un nouveau code ; comptes et réglages conservés', async () => {
      const code = await resetSetup(database as unknown as SetupDb);
      expect((await request(server()).get('/setup/status')).body).toEqual({ setupRequired: true });
      await request(server()).get('/setup/state').set(asSetup()).expect(401); // ancien code
      const state = await request(server()).get('/setup/state').set(asSetup(code)).expect(200);

      expect(state.body.admin).toBeNull();
      expect(await database.user.count({ where: { username: 'owner_b' } })).toBe(1);
      expect((await database.gameConfig.findUniqueOrThrow({ where: { key: 'gameSpeed' } })).value).toBe('10');

      // Inscriptions de nouveau fermées pendant le réarmement
      const reg = await request(server())
        .post('/auth/register')
        .send({ username: 'joueur2', email: 'joueur2@example.test', password: 'Test1234!' });
      expect(reg.status).toBe(503);

      // Un super admin déjà existant (même identifiant) : conflit explicite ; un nouveau compte passe
      await request(server()).put('/setup/smtp').set(asSetup(code)).send({}).expect(200);
      await request(server()).post('/setup/smtp/test').set(asSetup(code)).send({ to: 'prop@example.test' }).expect(200);
      await request(server()).post('/setup/admin').set(asSetup(code)).send(adminBody('b')).expect(409);
      smtp.clear();
      await request(server()).post('/setup/admin').set(asSetup(code)).send(adminBody('c')).expect(200);
      const token = extractToken(await smtp.waitFor('owner_c@example.test'));
      await request(server()).post('/auth/verify-email').send({ token }).expect(200);
      expect((await request(server()).get('/setup/status')).body).toEqual({ setupRequired: false });
    });
  });

  describe('serveurs existants', () => {
    it('la migration marque l\'installation terminée seulement si des comptes existent', async () => {
      const sql = readFileSync(
        join(process.cwd(), '../../packages/database/prisma/migrations/20261006100000_setup_completed_for_existing_installs/migration.sql'),
        'utf8',
      );
      // Base avec comptes (déjà le cas) : l'indicateur est posé
      await database.gameConfig.deleteMany({ where: { key: 'setup.completedAt' } });
      await database.$executeRawUnsafe(sql);
      expect(await database.gameConfig.findUnique({ where: { key: 'setup.completedAt' } })).not.toBeNull();

      // Base sans joueur (seul le compte système subsiste) : rien n'est posé (nouvelle installation)
      await database.gameConfig.deleteMany({ where: { key: 'setup.completedAt' } });
      await database.user.deleteMany({ where: { username: { not: '__abandoned__' } } });
      await database.$executeRawUnsafe(sql);
      expect(await database.gameConfig.findUnique({ where: { key: 'setup.completedAt' } })).toBeNull();
    });
  });
});
