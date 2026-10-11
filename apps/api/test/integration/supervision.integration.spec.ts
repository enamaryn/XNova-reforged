import { INestApplication } from '@nestjs/common';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { HealthService } from '../../src/supervision/health.service';
import { IncidentService } from '../../src/supervision/incident.service';
import { SupervisionConfigService } from '../../src/supervision/supervision-config.service';
import { SupervisionPurgeCronService } from '../../src/supervision/purge-cron.service';
import { reportIncident } from '../../src/supervision/incident-sink';
import { acquireGlobalLock, buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * SUPERVISION-LOCAL — journal local d'incidents, santé, configuration Sentry optionnelle (chiffrée),
 * RBAC, collecte frontend, rétention et absence de secrets dans les réponses, la base et l'audit.
 */
describe('API integration - Supervision locale', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let incidents: IncidentService;
  let releaseLock: () => void;
  const usernames: string[] = [];
  const TAG = `itsup-${Date.now().toString(36)}`;
  const DSN_SECRET = 'abcdef0123456789abcdef01234567';

  type Account = { token: string; userId: string };
  let superAdmin: Account;
  let admin: Account;
  let moderator: Account;
  let player: Account;

  const server = () => app.getHttpServer();
  const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
  const get = (a: Account, path: string) => request(server()).get(`/admin/supervision${path}`).set(auth(a));

  const signUp = async (role: 'PLAYER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN'): Promise<Account> => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const row = await database.user.update({ where: { username: user.username }, data: { role }, select: { id: true } });
    return { token: accessToken, userId: row.id };
  };

  const record = async (message: string, extra: Record<string, unknown> = {}) => {
    incidents.record({ level: 'error', source: 'api', message: `${TAG} ${message}`, ...extra } as never);
    await incidents.flush();
  };

  // --- Faux serveur Sentry ---
  let sentry: Server;
  let sentryStatus = 200;
  let sentryTestEvents = 0;
  const sentryDsn = () => `http://${DSN_SECRET}@127.0.0.1:${(sentry.address() as AddressInfo).port}/42`;

  beforeAll(async () => {
    releaseLock = await acquireGlobalLock('supervision');
    delete process.env.SENTRY_DSN;
    ({ app, database } = await createIntegrationApp());
    incidents = app.get(IncidentService);
    sentry = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        // Le SDK actif peut envoyer d'autres événements au même serveur : on ne compte que l'événement de test
        if (body.includes('xnova_test')) sentryTestEvents += 1;
        res.statusCode = sentryStatus;
        res.end('{}');
      });
    });
    await new Promise<void>((resolve) => sentry.listen(0, '127.0.0.1', resolve));
    superAdmin = await signUp('SUPER_ADMIN');
    admin = await signUp('ADMIN');
    moderator = await signUp('MODERATOR');
    player = await signUp('PLAYER');
  });

  afterAll(async () => {
    await database.incident.deleteMany({ where: { message: { startsWith: TAG } } });
    await database.incident.deleteMany({ where: { message: { contains: TAG } } });
    await app.get(SupervisionConfigService).clearSentry();
    await database.gameConfig.deleteMany({ where: { key: { startsWith: 'monitoring.local.' } } });
    await database.adminAuditLog.deleteMany({ where: { userId: { in: [superAdmin.userId, admin.userId] } } });
    for (const username of usernames) await cleanupTestUser(database, username);
    await new Promise<void>((resolve) => { sentry.closeAllConnections?.(); sentry.close(() => resolve()); });
    await app.close();
    releaseLock();
  });

  describe('RBAC', () => {
    it('refuse joueur et modérateur, anonyme compris, sur toutes les routes', async () => {
      for (const who of [player, moderator]) {
        await get(who, '/overview').expect(403);
        await get(who, '/incidents').expect(403);
        await get(who, '/config').expect(403);
        await get(who, '/export').expect(403);
      }
      await request(server()).get('/admin/supervision/overview').expect(401);
    });

    it('autorise la lecture à ADMIN et SUPER_ADMIN, les modifications au seul SUPER_ADMIN', async () => {
      await get(admin, '/overview').expect(200);
      await get(superAdmin, '/overview').expect(200);
      const put = (a: Account) => request(server()).put('/admin/supervision/config').set(auth(a));
      await put(admin).send({ local: { retentionDays: 10 } }).expect(403);
      await put(player).send({ local: { retentionDays: 10 } }).expect(403);
      await request(server()).delete('/admin/supervision/sentry').set(auth(admin)).expect(403);
      await request(server()).post('/admin/supervision/sentry/test').set(auth(admin)).send({}).expect(403);
      await request(server()).post('/admin/supervision/purge').set(auth(admin)).send({ confirm: true }).expect(403);
      const [one] = (await get(admin, '/incidents')).body.items;
      if (one) await request(server()).patch(`/admin/supervision/incidents/${one.id}/status`).set(auth(admin)).send({ status: 'seen' }).expect(403);
    });
  });

  describe('état général et démarrage sans Sentry', () => {
    it('fonctionne sans DSN : supervision locale active, Sentry inactif, tous les contrôles présents', async () => {
      const res = await get(superAdmin, '/overview').expect(200);
      expect(res.body.localActive).toBe(true);
      expect(res.body.config.sentry).toMatchObject({ enabled: false, active: false, source: 'none', dsnApiSet: false });
      const ids = res.body.health.checks.map((c: { id: string }) => c.id);
      expect(ids).toEqual(expect.arrayContaining(['database', 'redis', 'api', 'frontend', 'websocket', 'smtp', 'disk', 'system', 'cron', 'queues', 'version']));
      expect(['healthy', 'degraded', 'unavailable']).toContain(res.body.health.status);
      for (const check of res.body.health.checks) {
        expect(check).toMatchObject({ id: expect.any(String), status: expect.any(String), durationMs: expect.any(Number), checkedAt: expect.any(String), message: expect.any(String) });
      }
      const db = res.body.health.checks.find((c: { id: string }) => c.id === 'database');
      expect(db.status).toBe('ok');
    });

    it('les valeurs locales par défaut sont appliquées sur une installation existante (aucune ligne en base)', async () => {
      await database.gameConfig.deleteMany({ where: { key: { startsWith: 'monitoring.' } } });
      app.get(SupervisionConfigService)['invalidate']?.();
      const { body } = await get(superAdmin, '/config').expect(200);
      expect(body.local).toMatchObject({ retentionDays: 30, minLevel: 'error', warningsEnabled: false, autoPurge: true, alwaysActive: true });
    });
  });

  describe('santé : timeouts et indépendance des contrôles', () => {
    it('un contrôle bloqué expire sans retarder ni faire échouer les autres', async () => {
      const health = app.get(HealthService);
      const spy = jest.spyOn(health as never, 'checkRedis' as never).mockImplementation(() => new Promise(() => undefined) as never);
      const started = Date.now();
      const result = await health.checkAll();
      spy.mockRestore();
      expect(Date.now() - started).toBeLessThan(5000);
      const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
      expect(byId.redis).toMatchObject({ status: 'down', code: 'timeout' });
      expect(byId.database.status).toBe('ok');
      expect(result.status).not.toBe('unavailable');
    });

    it('PostgreSQL en panne : état « indisponible » mais les autres contrôles répondent', async () => {
      const health = app.get(HealthService);
      const spy = jest.spyOn(health as never, 'checkDatabase' as never).mockRejectedValue(new Error('connexion refusée') as never);
      const result = await health.checkAll();
      spy.mockRestore();
      expect(result.status).toBe('unavailable');
      expect(result.checks.find((c) => c.id === 'database')).toMatchObject({ status: 'down', code: 'error' });
      expect(result.checks.find((c) => c.id === 'api')?.status).toBe('ok');
    });

    it('Redis indisponible : dégradé seulement, le jeu reste servi', async () => {
      const health = app.get(HealthService);
      const spy = jest.spyOn(health as never, 'checkRedis' as never).mockRejectedValue(new Error('ECONNREFUSED') as never);
      const result = await health.checkAll();
      spy.mockRestore();
      expect(result.status).toBe('degraded');
    });

    it('une tâche planifiée silencieuse depuis trop longtemps est signalée', async () => {
      const { cronRegistry } = await import('../../src/supervision/cron-registry');
      cronRegistry.beat('tache-bloquee-test', 1000, 1);
      const entry = cronRegistry.snapshot().find((b) => b.name === 'tache-bloquee-test')!;
      entry.lastRunAt = Date.now() - 10 * 60_000;
      const result = await app.get(HealthService).checkAll();
      const cron = result.checks.find((c) => c.id === 'cron')!;
      expect(cron.status).not.toBe('ok');
      expect(JSON.stringify(cron.details)).toContain('tache-bloquee-test');
      cronRegistry.reset();
    });
  });

  describe('journal local', () => {
    it('regroupe les occurrences identiques et met à jour le compteur', async () => {
      await record('regroupement 111');
      await record('regroupement 222');
      await record('regroupement 333');
      const rows = await database.incident.findMany({ where: { message: { contains: `${TAG} regroupement` } } });
      expect(rows).toHaveLength(1);
      expect(rows[0].occurrences).toBe(3);
      expect(rows[0].status).toBe('new');
    });

    it('regroupement atomique sous concurrence (plusieurs instances, écritures simultanées)', async () => {
      const make = () => new IncidentService(database, app.get(SupervisionConfigService));
      const services = Array.from({ length: 6 }, make);
      services.forEach((s) => { for (let i = 0; i < 5; i += 1) s.record({ level: 'error', source: 'api', message: `${TAG} concurrence`, errorType: 'Boom' }); });
      await Promise.all(services.map((s) => s.flush()));
      const rows = await database.incident.findMany({ where: { message: `${TAG} concurrence` } });
      expect(rows).toHaveLength(1);
      expect(rows[0].occurrences).toBe(30);
    });

    it('un incident résolu est rouvert à la réapparition', async () => {
      await record('reouverture');
      const row = await database.incident.findFirstOrThrow({ where: { message: `${TAG} reouverture` } });
      await request(server()).patch(`/admin/supervision/incidents/${row.id}/status`).set(auth(superAdmin)).send({ status: 'resolved' }).expect(200);
      const resolved = await database.incident.findUniqueOrThrow({ where: { id: row.id } });
      expect(resolved).toMatchObject({ status: 'resolved', resolvedById: superAdmin.userId });
      expect(resolved.resolvedAt).not.toBeNull();
      await record('reouverture');
      const reopened = await database.incident.findUniqueOrThrow({ where: { id: row.id } });
      expect(reopened).toMatchObject({ status: 'new', resolvedAt: null, resolvedById: null, occurrences: 2 });
    });

    it('statuts : consulter, ignorer, rouvrir ; statut invalide refusé ; audit sans secret', async () => {
      await record('statuts');
      const row = await database.incident.findFirstOrThrow({ where: { message: `${TAG} statuts` } });
      for (const status of ['seen', 'ignored', 'new']) {
        const res = await request(server()).patch(`/admin/supervision/incidents/${row.id}/status`).set(auth(superAdmin)).send({ status }).expect(200);
        expect(res.body.status).toBe(status);
      }
      await request(server()).patch(`/admin/supervision/incidents/${row.id}/status`).set(auth(superAdmin)).send({ status: 'nope' }).expect(400);
      await request(server()).patch(`/admin/supervision/incidents/not-a-uuid/status`).set(auth(superAdmin)).send({ status: 'seen' }).expect(400);
      const audit = await database.adminAuditLog.findFirst({ where: { userId: superAdmin.userId, action: 'incident_status' } });
      expect(audit).not.toBeNull();
    });

    it('liste paginée côté serveur, filtres et recherche, champs limités', async () => {
      for (let i = 0; i < 7; i += 1) await record(`pagination ${i}-lettre${'abcdefg'[i]}`, { errorType: `E${i}`, level: i % 2 ? 'fatal' : 'error', source: i % 2 ? 'cron' : 'api' });
      const page1 = (await get(admin, `/incidents?q=${TAG}%20pagination&pageSize=3&page=1`).expect(200)).body;
      expect(page1.items).toHaveLength(3);
      expect(page1.total).toBeGreaterThanOrEqual(7);
      expect(page1.pageSize).toBe(3);
      const page2 = (await get(admin, `/incidents?q=${TAG}%20pagination&pageSize=3&page=2`).expect(200)).body;
      expect(page2.items[0].id).not.toBe(page1.items[0].id);
      const cron = (await get(admin, `/incidents?q=${TAG}&source=cron&level=fatal`).expect(200)).body;
      expect(cron.items.length).toBeGreaterThan(0);
      for (const item of cron.items) expect(item).toMatchObject({ source: 'cron', level: 'fatal' });
      const huge = (await get(admin, `/incidents?q=${TAG}&pageSize=100000`).expect(200)).body;
      expect(huge.pageSize).toBeLessThanOrEqual(50);
      expect(Object.keys(page1.items[0])).not.toContain('stack');
      expect(Object.keys(page1.items[0])).not.toContain('context');
      await get(admin, '/incidents?page=abc').expect(400);
    });

    it('détail : trace et contexte disponibles pour l’administrateur', async () => {
      incidents.record({ level: 'error', source: 'api', error: new Error(`${TAG} détail`), operation: 'GET /planets/3f2c0a8e-1111-4222-8333-444455556666', context: { planetId: 'x' } });
      await incidents.flush();
      const row = await database.incident.findFirstOrThrow({ where: { message: { startsWith: `${TAG} détail` } } });
      const res = await get(admin, `/incidents/${row.id}`).expect(200);
      expect(res.body.stack).toContain('Error');
      expect(res.body.operation).toBe('GET /planets/:id');
      await get(admin, '/incidents/3f2c0a8e-1111-4222-8333-444455556666').expect(404);
    });

    it('export JSON et CSV filtrés, sans secret', async () => {
      const json = (await get(admin, `/export?q=${TAG}%20pagination`).expect(200)).body;
      expect(json.count).toBeGreaterThanOrEqual(7);
      expect(json.incidents[0]).not.toHaveProperty('stack');
      const csv = await get(admin, `/export?format=csv&q=${TAG}%20pagination`).expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['content-disposition']).toContain('.csv');
      expect(csv.text.split('\n')[0]).toContain('id,level,source');
    });

    it('statistiques : ouverts, 24 h, plus fréquents', async () => {
      const { body } = await get(admin, '/overview').expect(200);
      expect(body.stats.open).toBeGreaterThan(0);
      expect(body.stats.last24h).toBeGreaterThan(0);
      expect(Array.isArray(body.stats.top)).toBe(true);
    });
  });

  describe('masquage dans la base, les réponses et l’audit', () => {
    it('aucun secret ne persiste, même imbriqué ou dans un message d’erreur', async () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij';
      incidents.record({
        level: 'error',
        source: 'api',
        error: Object.assign(new Error(`${TAG} secrets jwt=${jwt} user@example.com postgresql://admin:motdepasse@db/x`), {}),
        context: { body: { password: 'MotDePasse!1', deep: { refresh_token: 'rt-secret-9' } }, headers: { authorization: 'Bearer zzzzzzzzzz', cookie: 'sid=abc' }, smtp: { pass: 'smtp-pw' } },
      });
      await incidents.flush();
      const row = await database.incident.findFirstOrThrow({ where: { message: { startsWith: `${TAG} secrets` } } });
      const text = JSON.stringify(row);
      for (const leak of [jwt, 'user@example.com', 'motdepasse', 'MotDePasse!1', 'rt-secret-9', 'zzzzzzzzzz', 'sid=abc', 'smtp-pw']) expect(text).not.toContain(leak);
      const api = JSON.stringify((await get(admin, `/incidents/${row.id}`)).body) + JSON.stringify((await get(admin, `/export?q=${TAG}%20secrets`)).body);
      for (const leak of [jwt, 'motdepasse', 'MotDePasse!1', 'rt-secret-9']) expect(api).not.toContain(leak);
    });

    it('un incident enregistré ne ralentit pas et ne casse jamais l’appelant', () => {
      const started = Date.now();
      expect(() => reportIncident({ level: 'error', source: 'api', error: { get message(): string { throw new Error('piégé'); } } })).not.toThrow();
      expect(() => incidents.record(undefined as never)).not.toThrow();
      expect(Date.now() - started).toBeLessThan(100);
    });
  });

  describe('Sentry optionnel', () => {
    const put = (body: unknown) => request(server()).put('/admin/supervision/config').set(auth(superAdmin)).send(body as object);

    it('refuse un DSN invalide et l’activation sans DSN', async () => {
      await put({ sentry: { dsnApi: 'pas-un-dsn' } }).expect(400);
      await put({ sentry: { enabled: true } }).expect(400);
      await put({ sentry: { sampleRate: 0.9 } }).expect(400);
      await put({ sentry: { environment: 'prod uction!' } }).expect(400);
      await put({ local: { retentionDays: 0 } }).expect(400);
      await put({ local: { minLevel: 'debug' } }).expect(400);
      await put({ inconnu: true }).expect(400);
    });

    it('bascule local → local + Sentry → local sans jamais couper le journal local', async () => {
      const forwarded = jest.fn();
      incidents.setExternalForwarder(forwarded);
      incidents.setExternalForwarder(null);

      const enabled = await put({ sentry: { enabled: true, dsnApi: sentryDsn(), environment: 'staging', sampleRate: 0.2 }, local: { retentionDays: 14 } }).expect(200);
      expect(enabled.body.sentry).toMatchObject({ enabled: true, active: true, source: 'stored', dsnApiSet: true, environment: 'staging', sampleRate: 0.2 });
      expect(enabled.body.local.retentionDays).toBe(14);
      expect(JSON.stringify(enabled.body)).not.toContain(DSN_SECRET);

      await record('pendant sentry');
      expect(await database.incident.count({ where: { message: `${TAG} pendant sentry` } })).toBe(1);

      const disabled = await put({ sentry: { enabled: false } }).expect(200);
      expect(disabled.body.sentry).toMatchObject({ enabled: false, active: false, dsnApiSet: true });
      expect((await get(superAdmin, '/overview')).body.localActive).toBe(true);
      await record('apres sentry');
      expect(await database.incident.count({ where: { message: `${TAG} apres sentry` } })).toBe(1);
    });

    it('chiffre le DSN au repos et ne l’expose ni en réponse, ni en audit, ni dans la configuration publique', async () => {
      await put({ sentry: { enabled: true, dsnApi: sentryDsn(), dsnBrowser: sentryDsn() } }).expect(200);
      const rows = await database.gameConfig.findMany({ where: { key: { startsWith: 'monitoring.sentry.' } } });
      const stored = rows.find((r) => r.key === 'monitoring.sentry.dsnApi')!.value;
      expect(stored.startsWith('enc:v1:')).toBe(true);
      expect(JSON.stringify(rows)).not.toContain(DSN_SECRET);

      for (const res of [await get(superAdmin, '/config'), await get(admin, '/config'), await get(superAdmin, '/overview')]) {
        expect(JSON.stringify(res.body)).not.toContain(DSN_SECRET);
      }
      const audits = await database.adminAuditLog.findMany({ where: { userId: superAdmin.userId, action: { in: ['update_supervision', 'clear_sentry', 'test_sentry', 'purge_incidents'] } } });
      expect(audits.length).toBeGreaterThan(0);
      expect(JSON.stringify(audits)).not.toContain(DSN_SECRET);
      expect(JSON.stringify(audits.find((a) => a.action === 'update_supervision')?.changes)).toContain('sentry.dsnApi');
    });

    it('priorité : variable d’environnement > configuration enregistrée > désactivé', async () => {
      const config = app.get(SupervisionConfigService);
      process.env.SENTRY_DSN = `https://envkey0123456789@o9.ingest.sentry.io/9`;
      try {
        expect(await config.getEffectiveSentry()).toMatchObject({ active: true, source: 'environment' });
        const pub = (await get(superAdmin, '/config')).body;
        expect(pub.sentry.source).toBe('environment');
        expect(JSON.stringify(pub)).not.toContain('envkey0123456789');
      } finally {
        delete process.env.SENTRY_DSN;
      }
      expect(await config.getEffectiveSentry()).toMatchObject({ active: true, source: 'stored' });
      await put({ sentry: { enabled: false } }).expect(200);
      expect(await config.getEffectiveSentry()).toMatchObject({ active: false, source: 'none' });
    });

    it('test Sentry : accepté, refusé, indisponible — résultat et date conservés, jamais bloquant', async () => {
      const test = (body: object = {}) => request(server()).post('/admin/supervision/sentry/test').set(auth(superAdmin)).send(body);
      sentryStatus = 200;
      const hitsBefore = sentryTestEvents;
      const ok = await test({ dsnApi: sentryDsn() }).expect(201);
      expect(ok.body).toMatchObject({ ok: true, code: 'accepted' });
      expect(sentryTestEvents).toBe(hitsBefore + 1);
      expect(ok.body.lastTest.at).toBeTruthy();

      sentryStatus = 403;
      expect((await test({ dsnApi: sentryDsn() }).expect(201)).body).toMatchObject({ ok: false, code: 'rejected_key' });

      const down = await test({ dsnApi: 'http://abcdef0123456789@127.0.0.1:1/5' }).expect(201);
      expect(down.body.ok).toBe(false);
      expect(['unreachable', 'timeout']).toContain(down.body.code);

      expect((await test({ dsnApi: 'nimporte quoi' }).expect(201)).body).toMatchObject({ ok: false, code: 'invalid_dsn' });
      await test({ inconnu: 1 }).expect(400);

      const config = (await get(superAdmin, '/config')).body;
      expect(config.sentry.lastTest).toMatchObject({ ok: false, code: 'invalid_dsn' });
      expect(JSON.stringify(config)).not.toContain(DSN_SECRET);
      // Le jeu continue : la supervision locale reste active et répond
      expect((await get(superAdmin, '/overview')).body.localActive).toBe(true);
    });

    it('configuration publique du navigateur : DSN navigateur servi seulement si Sentry est actif', async () => {
      const pub = () => request(server()).get('/monitoring/public-config').expect(200);
      await put({ sentry: { enabled: false } }).expect(200);
      app.get(SupervisionConfigService)['invalidate']?.();
      // cache de 30 s côté contrôleur : on contourne en recréant l'état via un nouvel appel après expiration simulée
      const ctrl = app.get(require('../../src/supervision/client-reports.controller').ClientReportsController) as { publicCache: unknown };
      ctrl.publicCache = null;
      expect((await pub()).body.sentry).toEqual({ enabled: false });
      await put({ sentry: { enabled: true, dsnBrowser: 'https://browserkey01234567@o1.ingest.sentry.io/7' } }).expect(200);
      ctrl.publicCache = null;
      const body = (await pub()).body;
      expect(body.sentry).toMatchObject({ enabled: true, dsn: 'https://browserkey01234567@o1.ingest.sentry.io/7' });
      expect(JSON.stringify(body)).not.toContain(DSN_SECRET);
      ctrl.publicCache = null;
    });

    it('suppression : retire toute la configuration Sentry, le local reste actif', async () => {
      await request(server()).delete('/admin/supervision/sentry').set(auth(superAdmin)).expect(200);
      expect(await database.gameConfig.count({ where: { key: { startsWith: 'monitoring.sentry.' } } })).toBe(0);
      const cfg = (await get(superAdmin, '/config')).body;
      expect(cfg.sentry).toMatchObject({ enabled: false, active: false, dsnApiSet: false, lastTest: null });
      expect(cfg.local.alwaysActive).toBe(true);
    });
  });

  describe('collecte des erreurs du navigateur', () => {
    const send = (body: unknown) => request(server()).post('/monitoring/client-errors').send(body as object);

    it('accepte un rapport valide, sans authentification, et l’enregistre en « frontend »', async () => {
      await send({ message: `${TAG} erreur React`, kind: 'react', type: 'TypeError', route: '/fr/overview', stack: 'TypeError: x\n    at f (a.js:1:2)' }).expect(202);
      await incidents.flush();
      const row = await database.incident.findFirstOrThrow({ where: { message: { startsWith: `${TAG} erreur React` } } });
      expect(row.source).toBe('frontend');
    });

    it('schéma strict : champs inconnus, type inconnu, message vide ou trop long refusés', async () => {
      await send({ message: 'x', kind: 'react', extra: 1 }).expect(400);
      await send({ message: 'x', kind: 'inconnu' }).expect(400);
      await send({ message: '', kind: 'react' }).expect(400);
      await send({ message: 'x'.repeat(501), kind: 'react' }).expect(400);
      await send({ message: 'x', kind: 'react', stack: 'y'.repeat(4001) }).expect(400);
      await send({ kind: 'react' }).expect(400);
    });

    it('masque les secrets reçus du navigateur', async () => {
      await send({ message: `${TAG} navigateur token=abcdef0123 mail a@b.fr`, kind: 'window', route: '/fr/x?token=secret99' }).expect(202);
      await incidents.flush();
      const row = await database.incident.findFirstOrThrow({ where: { message: { startsWith: `${TAG} navigateur` } } });
      expect(JSON.stringify(row)).not.toContain('abcdef0123');
      expect(JSON.stringify(row)).not.toContain('a@b.fr');
      expect(JSON.stringify(row)).not.toContain('secret99');
    });

    it('limite le débit par adresse', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 40; i += 1) statuses.push((await send({ message: `${TAG} flood`, kind: 'network' })).status);
      expect(statuses).toContain(429);
      expect(statuses[0]).toBe(202);
    });
  });

  describe('purge et rétention', () => {
    const makeOld = async (suffix: string, days: number, status = 'new') => {
      await database.incident.create({
        data: { fingerprint: `${TAG}-${suffix}`, level: 'error', source: 'api', message: `${TAG} ancien ${suffix}`, firstSeen: new Date(Date.now() - days * 86_400_000), lastSeen: new Date(Date.now() - days * 86_400_000), status },
      });
    };

    it('la purge automatique supprime au-delà de la rétention et conserve le récent', async () => {
      await app.get(SupervisionConfigService).update({ local: { retentionDays: 30, autoPurge: true } });
      await makeOld('vieux', 60);
      await makeOld('recent', 2);
      await app.get(SupervisionPurgeCronService).purge();
      expect(await database.incident.count({ where: { fingerprint: `${TAG}-vieux` } })).toBe(0);
      expect(await database.incident.count({ where: { fingerprint: `${TAG}-recent` } })).toBe(1);
    });

    it('autoPurge désactivé : rien n’est supprimé automatiquement', async () => {
      await app.get(SupervisionConfigService).update({ local: { autoPurge: false } });
      await makeOld('garde', 90);
      await app.get(SupervisionPurgeCronService).purge();
      expect(await database.incident.count({ where: { fingerprint: `${TAG}-garde` } })).toBe(1);
      await app.get(SupervisionConfigService).update({ local: { autoPurge: true } });
    });

    it('le plafond d’incidents distincts supprime d’abord les plus anciens clos', async () => {
      await database.incident.deleteMany({ where: { fingerprint: { startsWith: `${TAG}-` } } });
      await makeOld('p1', 5, 'resolved');
      await makeOld('p2', 4, 'new');
      await makeOld('p3', 3, 'new');
      const total = await database.incident.count();
      const deleted = await incidents.trim(total - 1);
      expect(deleted).toBe(1);
      expect(await database.incident.count({ where: { fingerprint: `${TAG}-p1` } })).toBe(0);
    });

    it('purge manuelle : confirmation obligatoire, journal d’audit', async () => {
      const purge = (body: object) => request(server()).post('/admin/supervision/purge').set(auth(superAdmin)).send(body);
      await purge({}).expect(400);
      await purge({ confirm: false }).expect(400);
      await makeOld('manuel-clos', 10, 'resolved');
      await makeOld('manuel-ouvert', 10, 'new');
      const res = await purge({ confirm: true, olderThanDays: 5, onlyClosed: true }).expect(201);
      expect(res.body.deleted).toBeGreaterThanOrEqual(1);
      expect(await database.incident.count({ where: { fingerprint: `${TAG}-manuel-clos` } })).toBe(0);
      expect(await database.incident.count({ where: { fingerprint: `${TAG}-manuel-ouvert` } })).toBe(1);
      const audit = await database.adminAuditLog.findFirst({ where: { userId: superAdmin.userId, action: 'purge_incidents' } });
      expect(audit).not.toBeNull();
    });
  });

  describe('base de données indisponible', () => {
    it('la collecte ne lève rien et retombe sur la sortie standard, puis récupère', async () => {
      const writes: string[] = [];
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => { writes.push(String(chunk)); return true; }) as never);
      const exec = jest.spyOn(database, '$executeRaw').mockRejectedValue(new Error('connexion perdue') as never);
      try {
        incidents.record({ level: 'error', source: 'api', message: `${TAG} base coupee` });
        await expect(incidents.flush()).resolves.toBeUndefined();
      } finally {
        exec.mockRestore();
        stderr.mockRestore();
      }
      expect(writes.join('')).toContain('"storage":"unavailable"');
      expect(writes.join('')).toContain(`${TAG} base coupee`);
      await incidents.flush();
      expect(await database.incident.count({ where: { message: `${TAG} base coupee` } })).toBe(1);
    });
  });
});
