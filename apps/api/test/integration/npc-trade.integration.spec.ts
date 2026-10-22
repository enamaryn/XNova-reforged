import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  NPC_TRADE_CONFIG_KEY,
  NPC_TRADE_DEFAULTS,
  SHIPS,
  exchangeReceive,
  shipUnitPrice,
  type NpcTradeConfig,
} from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { NpcTradeService } from '../../src/npc-trade/npc-trade.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Commerce PNJ : échange et achat de vaisseaux au taux du jour, plafonds quotidiens (y compris en parallèle),
 * réglages admin validés et audités, conservation des stocks.
 */
describe('API integration - commerce PNJ', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: ReturnType<typeof buildTestUser>[] = [];
  const NOW = new Date('2026-07-10T12:00:00Z');

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    await database.gameConfig.deleteMany({ where: { key: NPC_TRADE_CONFIG_KEY } });
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.spyOn(NpcTradeService.prototype as any, 'now').mockReturnValue(NOW);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await database.gameConfig.deleteMany({ where: { key: NPC_TRADE_CONFIG_KEY } });
  });

  const STOCK = { metal: 500_000, crystal: 300_000, deuterium: 200_000 };
  const account = async (role: 'PLAYER' | 'ADMIN' | 'SUPER_ADMIN' = 'PLAYER', stock: Partial<typeof STOCK> = {}) => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const planetId = me.body.planets[0].id as string;
    await database.planet.update({ where: { id: planetId }, data: { ...STOCK, ...stock } });
    if (role !== 'PLAYER') await database.user.update({ where: { id: me.body.id }, data: { role } });
    return { token: accessToken as string, userId: me.body.id as string, planetId };
  };
  type Account = Awaited<ReturnType<typeof account>>;
  const auth = (u: Account) => ({ Authorization: `Bearer ${u.token}` });
  const stock = async (u: Account) => {
    const p = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    return { metal: p.metal, crystal: p.crystal, deuterium: p.deuterium };
  };
  const exchange = (u: Account, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/npc-trade/exchange')
      .set(auth(u))
      .send({ planetId: u.planetId, give: 'metal', want: 'crystal', amount: 10_000, ...body });
  const buyShips = (u: Account, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/npc-trade/ships')
      .set(auth(u))
      .send({ planetId: u.planetId, shipId: 202, amount: 2, ...body });
  const setConfig = (admin: Account, patch: Partial<NpcTradeConfig>) =>
    request(app.getHttpServer())
      .put('/admin/npc-trade')
      .set(auth(admin))
      .send({ ...NPC_TRADE_DEFAULTS, ...patch });

  describe('état du jour', () => {
    it('expose la saison, les taux, les prix et les plafonds', async () => {
      const u = await account();
      const res = await request(app.getHttpServer()).get('/npc-trade').set(auth(u)).expect(200);
      expect(res.body).toMatchObject({ enabled: true, season: 'summer', day: '2026-07-10' });
      expect(res.body.rates).toHaveLength(6);
      expect(res.body.ships.map((s: any) => s.id)).toEqual(NPC_TRADE_DEFAULTS.ships);
      expect(res.body.caps.exchange).toEqual({ cap: NPC_TRADE_DEFAULTS.exchangeDailyCap, used: 0 });
      const rate = res.body.rates.find((r: any) => r.give === 'metal' && r.want === 'crystal').rate;
      expect(rate).toBeCloseTo(exchangeReceive('metal', 'crystal', 1_000_000, NOW, NPC_TRADE_DEFAULTS) / 1_000_000, 4);
    });

    it('exige un joueur connecté', async () => {
      await request(app.getHttpServer()).get('/npc-trade').expect(401);
    });
  });

  describe('échange de ressources', () => {
    it('débite la ressource donnée et crédite la ressource reçue au taux du jour', async () => {
      const u = await account();
      const before = await stock(u);
      const expected = exchangeReceive('metal', 'crystal', 10_000, NOW, NPC_TRADE_DEFAULTS);
      const res = await exchange(u).expect(201);
      expect(res.body).toMatchObject({ given: 10_000, received: expected });
      const after = await stock(u);
      expect(after.metal).toBe(before.metal - 10_000);
      expect(after.crystal).toBe(before.crystal + expected);
      expect(after.deuterium).toBe(before.deuterium);
      const rows = await database.npcTrade.findMany({ where: { userId: u.userId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: 'EXCHANGE', giveAmount: 10_000, receiveAmount: expected, value: 10_000 });
    });

    it('refuse un stock insuffisant, une planète étrangère, deux fois la même ressource et une ressource inconnue', async () => {
      const u = await account();
      const other = await account();
      const before = await stock(u);
      await exchange(u, { amount: 600_000 }).expect(400);
      await exchange(u, { planetId: other.planetId }).expect(404);
      await exchange(u, { want: 'metal' }).expect(400);
      await exchange(u, { give: 'or' }).expect(400);
      await exchange(u, { amount: 0 }).expect(400);
      await exchange(u, { amount: 1.5 }).expect(400);
      expect(await stock(u)).toEqual(before);
      expect(await database.npcTrade.count({ where: { userId: u.userId } })).toBe(0);
    });

    it('refuse une quantité trop faible pour rapporter une unité', async () => {
      const u = await account();
      await exchange(u, { give: 'metal', want: 'deuterium', amount: 1 }).expect(400);
    });

    it('respecte le plafond quotidien, en valeur équivalent métal', async () => {
      const admin = await account('ADMIN');
      const u = await account();
      await setConfig(admin, { exchangeDailyCap: 25_000 }).expect(200);
      await exchange(u, { amount: 20_000 }).expect(201);
      const refused = await exchange(u, { amount: 6_000 }).expect(400);
      expect(refused.body.message).toMatch(/Plafond quotidien/);
      await exchange(u, { amount: 5_000 }).expect(201);
      const state = await request(app.getHttpServer()).get('/npc-trade').set(auth(u)).expect(200);
      expect(state.body.caps.exchange).toEqual({ cap: 25_000, used: 25_000 });
    });

    it('remet le plafond à zéro le jour suivant', async () => {
      const admin = await account('ADMIN');
      const u = await account();
      await setConfig(admin, { exchangeDailyCap: 10_000 }).expect(200);
      await exchange(u, { amount: 10_000 }).expect(201);
      await exchange(u, { amount: 1_000 }).expect(400);
      jest.spyOn(NpcTradeService.prototype as any, 'now').mockReturnValue(new Date('2026-07-11T00:00:01Z'));
      await exchange(u, { amount: 10_000 }).expect(201);
    });

    it('des échanges simultanés ne dépassent jamais le plafond', async () => {
      const admin = await account('ADMIN');
      const u = await account();
      await setConfig(admin, { exchangeDailyCap: 30_000 }).expect(200);
      const results = await Promise.all(Array.from({ length: 6 }, () => exchange(u, { amount: 10_000 })));
      const ok = results.filter((r) => r.status === 201).length;
      expect(ok).toBe(3);
      expect(results.filter((r) => r.status === 400)).toHaveLength(3);
      const sum = await database.npcTrade.aggregate({ where: { userId: u.userId }, _sum: { value: true } });
      expect(sum._sum.value).toBe(30_000);
    });

    it('refuse quand le marchand est fermé', async () => {
      const admin = await account('ADMIN');
      const u = await account();
      await setConfig(admin, { enabled: false }).expect(200);
      const res = await exchange(u).expect(400);
      expect(res.body.message).toMatch(/marchand/);
    });
  });

  describe('achat de vaisseaux', () => {
    it('débite le prix du jour, livre les vaisseaux immédiatement et cumule', async () => {
      const u = await account();
      const before = await stock(u);
      const unit = shipUnitPrice(SHIPS[202].cost, NOW, NPC_TRADE_DEFAULTS);
      const res = await buyShips(u, { amount: 2 }).expect(201);
      expect(res.body).toMatchObject({ shipId: 202, amount: 2, paid: { metal: unit.metal * 2, crystal: unit.crystal * 2 } });
      const after = await stock(u);
      expect(after.metal).toBe(before.metal - unit.metal * 2);
      expect(after.crystal).toBe(before.crystal - unit.crystal * 2);
      await buyShips(u, { amount: 1 }).expect(201);
      const ship = await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: u.planetId, shipId: 202 } } });
      expect(ship.amount).toBe(3);
    });

    it("refuse un vaisseau non proposé, le satellite solaire, un stock insuffisant ou une planète étrangère", async () => {
      const u = await account();
      const other = await account();
      const before = await stock(u);
      await buyShips(u, { shipId: 214 }).expect(400); // Étoile de la Mort : pas dans la liste par défaut
      await buyShips(u, { shipId: 212 }).expect(400);
      await buyShips(u, { shipId: 9999 }).expect(400);
      await buyShips(u, { amount: 1000 }).expect(400);
      await buyShips(u, { planetId: other.planetId }).expect(404);
      expect(await stock(u)).toEqual(before);
      expect(await database.ship.count({ where: { planetId: u.planetId } })).toBe(0);
    });

    it('un vaisseau ajouté par l’admin devient disponible, sans prérequis de recherche', async () => {
      const admin = await account('ADMIN');
      const u = await account('PLAYER', { metal: 900_000, crystal: 900_000, deuterium: 900_000 });
      await buyShips(u, { shipId: 206 }).expect(400);
      await setConfig(admin, { ships: [...NPC_TRADE_DEFAULTS.ships, 206] }).expect(200);
      await buyShips(u, { shipId: 206, amount: 1 }).expect(201);
    });

    it('respecte le plafond quotidien des vaisseaux', async () => {
      const admin = await account('ADMIN');
      const u = await account();
      const unit = shipUnitPrice(SHIPS[202].cost, NOW, NPC_TRADE_DEFAULTS);
      const value = unit.metal + unit.crystal * 1.5;
      await setConfig(admin, { shipDailyCap: Math.floor(value * 2.5) }).expect(200);
      await buyShips(u, { amount: 2 }).expect(201);
      const refused = await buyShips(u, { amount: 1 }).expect(400);
      expect(refused.body.message).toMatch(/Plafond quotidien/);
    });

    it('les achats simultanés ne débitent qu’une fois le stock disponible', async () => {
      const u = await account('PLAYER', { metal: 5_000, crystal: 5_000, deuterium: 0 });
      const unit = shipUnitPrice(SHIPS[202].cost, NOW, NPC_TRADE_DEFAULTS);
      const affordable = Math.floor(5_000 / unit.metal);
      const results = await Promise.all(Array.from({ length: 4 }, () => buyShips(u, { amount: 1 })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(affordable);
      const after = await stock(u);
      expect(after.metal).toBeGreaterThanOrEqual(0);
      expect(after.metal).toBe(5_000 - unit.metal * affordable);
    });
  });

  describe('console admin', () => {
    it('réserve la lecture et la modification aux administrateurs', async () => {
      const player = await account();
      await request(app.getHttpServer()).get('/admin/npc-trade').set(auth(player)).expect(403);
      await request(app.getHttpServer()).put('/admin/npc-trade').set(auth(player)).send(NPC_TRADE_DEFAULTS).expect(403);
      await request(app.getHttpServer()).delete('/admin/npc-trade').set(auth(player)).expect(403);
      const admin = await account('ADMIN');
      const res = await request(app.getHttpServer()).get('/admin/npc-trade').set(auth(admin)).expect(200);
      expect(res.body.config).toEqual(NPC_TRADE_DEFAULTS);
      expect(res.body.sellableShips.map((s: any) => s.id)).not.toContain(212);
    });

    it('enregistre un réglage valide, l’applique aux taux et l’inscrit au journal d’audit', async () => {
      const admin = await account('SUPER_ADMIN');
      const u = await account();
      await setConfig(admin, { spread: 0.3, dailyVariation: 0 }).expect(200);
      const state = await request(app.getHttpServer()).get('/npc-trade').set(auth(u)).expect(200);
      expect(state.body.spread).toBeCloseTo(0.3, 10);
      const audit = await database.adminAuditLog.findFirstOrThrow({
        where: { userId: admin.userId, action: 'update_npc_trade' },
        orderBy: { createdAt: 'desc' },
      });
      expect((audit.changes as any).after.spread).toBe(0.3);
      expect((audit.changes as any).before.spread).toBe(NPC_TRADE_DEFAULTS.spread);
    });

    it('refuse un réglage invalide sans rien enregistrer', async () => {
      const admin = await account('ADMIN');
      const res = await setConfig(admin, { spread: 0.9 } as any).expect(400);
      expect(res.body.message).toMatch(/spread/);
      await setConfig(admin, { ships: [212] }).expect(400);
      await request(app.getHttpServer()).put('/admin/npc-trade').set(auth(admin)).send({}).expect(400);
      expect(await database.gameConfig.count({ where: { key: NPC_TRADE_CONFIG_KEY } })).toBe(0);
    });

    it('revient aux valeurs par défaut', async () => {
      const admin = await account('ADMIN');
      await setConfig(admin, { spread: 0.4 }).expect(200);
      const res = await request(app.getHttpServer()).delete('/admin/npc-trade').set(auth(admin)).expect(200);
      expect(res.body.config).toEqual(NPC_TRADE_DEFAULTS);
      expect(await database.gameConfig.count({ where: { key: NPC_TRADE_CONFIG_KEY } })).toBe(0);
    });
  });
});
