import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { ServerConfigService } from '../../src/server-config/server-config.service';
import { acquireGlobalLock, buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';
import { FakeSmtp } from './fake-smtp';

/**
 * Langue du serveur (choisie à l'installation), langue du joueur, emails dans la langue du destinataire,
 * noms du jeu localisés selon l'en-tête X-Locale.
 */
describe('API integration - langues (serveur, joueur, emails, textes du jeu)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let serverConfig: ServerConfigService;
  let releaseLock: () => void = () => undefined;
  const smtp = new FakeSmtp();
  const usernames: string[] = [];
  const server = () => app.getHttpServer();
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const setLanguage = async (language: 'fr' | 'en' | 'es' | 'de' | 'it') => {
    await database.gameConfig.upsert({
      where: { key: 'server.language' },
      create: { key: 'server.language', value: language },
      update: { value: language },
    });
    await serverConfig.getConfig(true); // vide le cache mémoire et Redis
  };

  const signUp = async (locale?: string) => {
    const user = buildTestUser();
    usernames.push(user.username);
    const req = request(server()).post('/auth/register');
    if (locale) req.set('X-Locale', locale);
    const res = await req.send(user).expect(201);
    const mail = await smtp.waitFor(user.email);
    return { user, res, mail };
  };

  beforeAll(async () => {
    releaseLock = await acquireGlobalLock('smtp-config');
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    serverConfig = app.get(ServerConfigService);
    await smtp.start();
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
  }, 180_000);

  beforeEach(async () => {
    smtp.clear();
    await setLanguage('fr');
  });

  afterAll(async () => {
    await database.gameConfig.deleteMany({ where: { key: { in: ['server.language'] } } });
    await database.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
    await serverConfig.getConfig(true);
    await smtp.stop();
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
    releaseLock();
  });

  it('la langue du serveur est publique et suit le réglage', async () => {
    expect((await request(server()).get('/setup/status').expect(200)).body.language).toBe('fr');
    await setLanguage('de');
    expect((await request(server()).get('/setup/status').expect(200)).body.language).toBe('de');
  });

  it('une langue inconnue en base est ignorée (retour au français)', async () => {
    await database.gameConfig.update({ where: { key: 'server.language' }, data: { value: 'xx' } });
    await serverConfig.getConfig(true);
    expect((await request(server()).get('/setup/status').expect(200)).body.language).toBe('fr');
  });

  it('l’inscription mémorise la langue de l’interface et écrit l’email dans cette langue', async () => {
    const { user, mail } = await signUp('en');
    const row = await database.user.findFirstOrThrow({ where: { username: user.username } });
    expect(row.locale).toBe('en');
    expect(mail.body).toContain(`Hello ${user.username}`);
    expect(mail.body).toMatch(/\/en\/verify-email\?token=/);
  });

  it('sans langue de requête, le joueur et l’email prennent la langue du serveur', async () => {
    await setLanguage('de');
    const { user, mail } = await signUp();
    const row = await database.user.findFirstOrThrow({ where: { username: user.username } });
    expect(row.locale).toBe('de');
    expect(mail.body).toContain(`Hallo ${user.username}`);
    expect(mail.body).toMatch(/\/de\/verify-email\?token=/);
  });

  it('un en-tête de langue inconnu est ignoré', async () => {
    await setLanguage('es');
    const { user, mail } = await signUp('klingon');
    const row = await database.user.findFirstOrThrow({ where: { username: user.username } });
    expect(row.locale).toBe('es');
    expect(mail.body).toContain(`Hola ${user.username}`);
  });

  it('le joueur peut changer sa langue ; elle est servie par /auth/me et refusée si inconnue', async () => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    await request(server()).put('/auth/locale').set(bearer(accessToken)).send({ locale: 'it' }).expect(200);
    const me = await request(server()).get('/auth/me').set(bearer(accessToken)).expect(200);
    expect(me.body.locale).toBe('it');
    await request(server()).put('/auth/locale').set(bearer(accessToken)).send({ locale: 'tlh' }).expect(400);
    await request(server()).put('/auth/locale').send({ locale: 'en' }).expect(401);
  });

  it('le mot de passe oublié suit la langue de la requête, sinon celle du compte', async () => {
    const { user } = await signUp('es');
    smtp.clear();
    await request(server()).post('/auth/forgot-password').send({ email: user.email }).expect(200);
    const fromAccount = await smtp.waitFor(user.email);
    expect(fromAccount.body).toContain(`Hola ${user.username}`);
    expect(fromAccount.body).toMatch(/\/es\/reset-password\?token=/);

    smtp.clear();
    await request(server()).post('/auth/forgot-password').set('X-Locale', 'it').send({ email: user.email }).expect(200);
    const fromRequest = await smtp.waitFor(user.email);
    expect(fromRequest.body).toContain(`Ciao ${user.username}`);
  });

  it('les noms et libellés du jeu suivent l’en-tête X-Locale', async () => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(server()).get('/auth/me').set(bearer(accessToken)).expect(200);
    const planetId = me.body.planets[0].id;

    const names = async (locale?: string) => {
      const req = request(server()).get(`/planets/${planetId}/buildings`).set(bearer(accessToken));
      if (locale) req.set('X-Locale', locale);
      const res = await req.expect(200);
      const metalMine = res.body.buildings.find((b: { id: number }) => b.id === 1);
      return metalMine as { name: string; description: string; upgrade: { effects: { label: string }[] } };
    };

    expect((await names()).name).toBe('Mine de Métal');
    const en = await names('en');
    expect(en.name).toBe('Metal Mine');
    expect(en.description).toContain('metal');
    expect(en.upgrade.effects.map((effect) => effect.label)).toContain('Mine efficiency');
    expect((await names('de')).name).toBe('Metallmine');

    const ships = await request(server()).get('/shipyard').query({ planetId }).set(bearer(accessToken)).set('X-Locale', 'it');
    if (ships.status === 200) {
      const list = Array.isArray(ships.body) ? ships.body : ships.body.ships;
      expect(list.find((s: { id: number }) => s.id === 212).name).toBe('Satellite solare');
    }
  });
});
