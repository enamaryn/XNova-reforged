import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MULTI_ACCOUNT_CONFIG_KEY, MULTI_ACCOUNT_DEFAULTS, canonicalizeEmail } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { MultiAccountService } from '../../src/multi-account/multi-account.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp } from './helpers';

/**
 * Doubles comptes : email canonique (alias +tag, points Gmail), adresses IP vues, limite d'inscriptions par IP,
 * transferts refusés entre comptes liés (marché, transport, attaque), exemptions et réglages admin.
 */
describe('API integration - doubles comptes', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: ReturnType<typeof buildTestUser>[] = [];
  let ipCounter = 0;
  /** Adresse documentaire (RFC 5737) unique par appel : jamais de collision entre tests. */
  const freshIp = () => `198.51.${Math.floor(Math.random() * 200)}.${(ipCounter += 1) % 250}`;

  beforeAll(async () => {
    // Les contrôles sont coupés par défaut dans les suites ; celle-ci les active et lit l'IP des en-têtes
    process.env.MULTI_ACCOUNT_CHECKS = 'on';
    process.env.TRUST_PROXY = 'loopback';
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    if (database) {
      for (const user of users) await cleanupTestUser(database, user.username);
      await database.gameConfig.deleteMany({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } });
    }
    delete process.env.TRUST_PROXY;
    process.env.MULTI_ACCOUNT_CHECKS = 'off';
    if (app) await app.close();
  });

  afterEach(async () => {
    if (database) await database.gameConfig.deleteMany({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } });
  });

  const http = () => request(app.getHttpServer());
  const register = (ip: string, overrides: Partial<ReturnType<typeof buildTestUser>> = {}) => {
    const user = { ...buildTestUser(), ...overrides };
    users.push(user);
    return { user, response: http().post('/auth/register').set('X-Forwarded-For', ip).send(user) };
  };
  const STOCK = { metal: 500_000, crystal: 300_000, deuterium: 200_000 };
  const account = async (ip: string, role: 'PLAYER' | 'ADMIN' = 'PLAYER') => {
    const { user, response } = register(ip);
    await response.expect(201);
    const login = await http()
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ identifier: user.username, password: user.password })
      .expect(200);
    const token = login.body.tokens.accessToken as string;
    const me = await http().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    const planet = me.body.planets[0];
    await database.planet.update({ where: { id: planet.id }, data: STOCK });
    await database.user.update({
      where: { id: me.body.id },
      data: { lastActive: new Date(Date.now() - 30 * 86_400_000), ...(role === 'ADMIN' ? { role } : {}) },
    });
    return { token, userId: me.body.id as string, planet, user };
  };
  type Account = Awaited<ReturnType<typeof account>>;
  const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

  describe('email canonique', () => {
    it('enregistre la forme canonique à l’inscription', async () => {
      const unique = buildTestUser().username;
      const { response } = register(freshIp(), { email: `${unique}+jeu@example.test` });
      await response.expect(201);
      const row = await database.user.findFirstOrThrow({ where: { email: `${unique}+jeu@example.test` } });
      expect(row.emailCanonical).toBe(`${unique}@example.test`);
    });

    it('refuse un alias de la même boîte (étiquette +, points Gmail, casse)', async () => {
      const base = `dc${Math.random().toString(36).slice(2, 8)}`;
      await register(freshIp(), { email: `${base}@gmail.com` }).response.expect(201);
      for (const alias of [`${base}+autre@gmail.com`, `${base.slice(0, 3)}.${base.slice(3)}@gmail.com`, `${base.toUpperCase()}@googlemail.com`]) {
        const res = await register(freshIp(), { email: alias }).response.expect(409);
        expect(res.body.message).toMatch(/email/);
      }
      expect(await database.user.count({ where: { emailCanonical: canonicalizeEmail(`${base}@gmail.com`) } })).toBe(1);
    });

    it('deux inscriptions simultanées sous deux alias : une seule réussit', async () => {
      const base = `dc${Math.random().toString(36).slice(2, 8)}`;
      const results = await Promise.all([
        register(freshIp(), { email: `${base}+a@example.test` }).response,
        register(freshIp(), { email: `${base}+b@example.test` }).response,
        register(freshIp(), { email: `${base}+c@example.test` }).response,
      ]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    });
  });

  describe('adresses IP et limite d’inscriptions', () => {
    it('mémorise l’adresse à l’inscription et à la connexion, sans doublon', async () => {
      const ip = freshIp();
      const a = await account(ip);
      await http().post('/auth/login').set('X-Forwarded-For', ip).send({ identifier: a.user.username, password: a.user.password }).expect(200);
      const rows = await database.accountIp.findMany({ where: { userId: a.userId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].ip).toBe(ip);
      await http().post('/auth/login').set('X-Forwarded-For', freshIp()).send({ identifier: a.user.username, password: a.user.password }).expect(200);
      expect(await database.accountIp.count({ where: { userId: a.userId } })).toBe(2);
    });

    it('refuse l’inscription au-delà du nombre de comptes admis par adresse', async () => {
      const ip = freshIp();
      for (let i = 0; i < MULTI_ACCOUNT_DEFAULTS.maxAccountsPerIp; i += 1) await account(ip);
      const refused = await register(ip).response.expect(403);
      expect(refused.body.message).toMatch(/Trop de comptes/);
      await register(freshIp()).response.expect(201);
    });

    it('compte pour un seul les comptes déclarés légitimes ensemble (exemption)', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      const ip = freshIp();
      const first = await account(ip);
      const second = await account(ip);
      const third = await account(ip);
      await http().put('/admin/multi-account/config').set(auth(admin)).send({ ...MULTI_ACCOUNT_DEFAULTS, maxAccountsPerIp: 2 }).expect(200);
      await register(ip).response.expect(403);
      await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: first.userId, userB: second.userId, reason: 'frères' }).expect(201);
      await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: second.userId, userB: third.userId, reason: 'frères' }).expect(201);
      // trois comptes exemptés entre eux ne comptent que pour un : une inscription de plus passe
      await register(ip).response.expect(201);
    });

    it('0 compte par adresse désactive la limite', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      await http().put('/admin/multi-account/config').set(auth(admin)).send({ ...MULTI_ACCOUNT_DEFAULTS, maxAccountsPerIp: 0 }).expect(200);
      const ip = freshIp();
      for (let i = 0; i < 5; i += 1) await account(ip);
    });

    it('ignore une adresse hors fenêtre et purge les adresses trop anciennes', async () => {
      const ip = freshIp();
      const accounts = [];
      for (let i = 0; i < MULTI_ACCOUNT_DEFAULTS.maxAccountsPerIp; i += 1) accounts.push(await account(ip));
      await database.accountIp.updateMany({
        where: { userId: { in: accounts.map((a) => a.userId) } },
        data: { lastSeenAt: new Date(Date.now() - 40 * 86_400_000) },
      });
      await register(ip).response.expect(201); // les 3 comptes n'ont pas été vus depuis 40 jours (> 30)
      await database.accountIp.updateMany({ where: { userId: accounts[0].userId }, data: { lastSeenAt: new Date(Date.now() - 100 * 86_400_000) } });
      const removed = await app.get(MultiAccountService).purgeOldIps();
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await database.accountIp.count({ where: { userId: accounts[0].userId } })).toBe(0);
      expect(await database.accountIp.count({ where: { userId: accounts[1].userId } })).toBe(1);
    });
  });

  describe('transferts entre comptes liés', () => {
    const offer = (seller: Account, amount = 1000) =>
      http()
        .post('/market/offers')
        .set(auth(seller))
        .send({ planetId: seller.planet.id, give: 'metal', want: 'crystal', amount, rate: 1 })
        .expect(201);
    const buy = (buyer: Account, offerId: string, amount: number) =>
      http().post(`/market/offers/${offerId}/buy`).set(auth(buyer)).send({ planetId: buyer.planet.id, amount });

    it('refuse l’achat au marché entre deux comptes de la même adresse, l’autorise sinon', async () => {
      const ip = freshIp();
      const seller = await account(ip);
      const linked = await account(ip);
      const stranger = await account(freshIp());
      const created = await offer(seller);
      const before = await database.planet.findUniqueOrThrow({ where: { id: linked.planet.id } });
      const refused = await buy(linked, created.body.id, 100).expect(403);
      expect(refused.body.message).toMatch(/meme personne/);
      const after = await database.planet.findUniqueOrThrow({ where: { id: linked.planet.id } });
      expect([after.metal, after.crystal, after.deuterium]).toEqual([before.metal, before.crystal, before.deuterium]);
      await buy(stranger, created.body.id, 100).expect(201);
    });

    it('refuse aussi pour un email canonique identique hérité (compte ancien) sans IP commune', async () => {
      const seller = await account(freshIp());
      const other = await account(freshIp());
      await database.user.update({ where: { id: other.userId }, data: { emailCanonical: (await database.user.findUniqueOrThrow({ where: { id: seller.userId } })).emailCanonical } });
      const created = await offer(seller);
      await buy(other, created.body.id, 100).expect(403);
    });

    it('autorise le transfert quand l’administrateur l’exempte, le refuse de nouveau une fois l’exemption retirée', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      const ip = freshIp();
      const seller = await account(ip);
      const linked = await account(ip);
      const created = await offer(seller, 5000);
      await buy(linked, created.body.id, 100).expect(403);
      await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: linked.userId, userB: seller.userId, reason: 'colocataires' }).expect(201);
      await buy(linked, created.body.id, 100).expect(201);
      await http().delete('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: seller.userId, userB: linked.userId }).expect(200);
      await buy(linked, created.body.id, 100).expect(403);
    });

    it('le réglage « bloquer les transferts » peut être coupé par l’administrateur', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      const ip = freshIp();
      const seller = await account(ip);
      const linked = await account(ip);
      const created = await offer(seller);
      await http().put('/admin/multi-account/config').set(auth(admin)).send({ ...MULTI_ACCOUNT_DEFAULTS, blockLinkedTransfers: false }).expect(200);
      await buy(linked, created.body.id, 100).expect(201);
    });

    it('refuse un transport et une attaque vers un compte lié, sans rien débiter', async () => {
      const ip = freshIp();
      const sender = await account(ip);
      const target = await account(ip);
      await database.ship.upsert({
        where: { planetId_shipId: { planetId: sender.planet.id, shipId: 202 } },
        update: { amount: 5 },
        create: { planetId: sender.planet.id, shipId: 202, amount: 5 },
      });
      const send = (mission: number) =>
        http()
          .post('/fleet/send')
          .set(auth(sender))
          .send({
            planetId: sender.planet.id,
            toGalaxy: target.planet.galaxy,
            toSystem: target.planet.system,
            toPosition: target.planet.position,
            mission,
            speedPercent: 100,
            ships: { '202': 2 },
            cargo: mission === 3 ? { metal: 100, crystal: 0, deuterium: 0 } : {},
          });
      await send(3).expect(403);
      await send(1).expect(403);
      const planet = await database.planet.findUniqueOrThrow({ where: { id: sender.planet.id } });
      expect(planet.metal).toBe(STOCK.metal);
      expect(await database.fleet.count({ where: { userId: sender.userId } })).toBe(0);
      expect((await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: sender.planet.id, shipId: 202 } } })).amount).toBe(5);
    });
  });

  describe('console admin', () => {
    it('réserve la lecture et les modifications aux administrateurs', async () => {
      const player = await account(freshIp());
      await http().get('/admin/multi-account').set(auth(player)).expect(403);
      await http().put('/admin/multi-account/config').set(auth(player)).send(MULTI_ACCOUNT_DEFAULTS).expect(403);
      await http().post('/admin/multi-account/exemptions').set(auth(player)).send({ userA: player.userId, userB: player.userId, reason: 'test' }).expect(403);
      await http().get('/admin/multi-account').expect(401);
    });

    it('liste les groupes de comptes liés avec leurs raisons, puis marque les exemptions', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      const ip = freshIp();
      const a = await account(ip);
      const b = await account(ip);
      const res = await http().get('/admin/multi-account').set(auth(admin)).expect(200);
      const group = res.body.groups.find((g: any) => g.users.some((u: any) => u.id === a.userId));
      expect(group.users.map((u: any) => u.id).sort()).toEqual([a.userId, b.userId].sort());
      expect(group.open).toBe(true);
      expect(group.pairs[0].reasons).toEqual([{ type: 'ip', value: ip }]);
      expect(res.body.openGroups).toBeGreaterThanOrEqual(1);
      const after = await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: b.userId, userB: a.userId, reason: 'même foyer' }).expect(201);
      const closed = after.body.groups.find((g: any) => g.users.some((u: any) => u.id === a.userId));
      expect(closed.open).toBe(false);
      expect(closed.pairs[0]).toMatchObject({ exempt: true, exemptionReason: 'même foyer' });
    });

    it('valide les réglages sans rien enregistrer, audite et revient aux valeurs par défaut', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      const bad = await http().put('/admin/multi-account/config').set(auth(admin)).send({ ...MULTI_ACCOUNT_DEFAULTS, maxAccountsPerIp: -3 }).expect(400);
      expect(bad.body.message).toMatch(/maxAccountsPerIp/);
      await http().put('/admin/multi-account/config').set(auth(admin)).send({}).expect(400);
      expect(await database.gameConfig.count({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } })).toBe(0);
      await http().put('/admin/multi-account/config').set(auth(admin)).send({ ...MULTI_ACCOUNT_DEFAULTS, maxAccountsPerIp: 7 }).expect(200);
      const audit = await database.adminAuditLog.findFirstOrThrow({ where: { userId: admin.userId, action: 'update_multi_account' }, orderBy: { createdAt: 'desc' } });
      expect((audit.changes as any).after.maxAccountsPerIp).toBe(7);
      const reset = await http().delete('/admin/multi-account/config').set(auth(admin)).expect(200);
      expect(reset.body.config).toEqual(MULTI_ACCOUNT_DEFAULTS);
    });

    it('refuse une exemption pour un compte inconnu ou le même compte deux fois', async () => {
      const admin = await account(freshIp(), 'ADMIN');
      await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: admin.userId, userB: admin.userId, reason: 'test' }).expect(400);
      await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: admin.userId, userB: '00000000-0000-4000-8000-000000000000', reason: 'test' }).expect(400);
      await http().post('/admin/multi-account/exemptions').set(auth(admin)).send({ userA: admin.userId, userB: 'pas-un-uuid', reason: 'test' }).expect(400);
    });
  });
});
