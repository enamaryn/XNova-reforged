import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MARKET_MAX_ACTIVE_OFFERS, MARKET_OFFER_HOURS } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { MarketService } from '../../src/market/market.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
  createPlanetAtFreeCoordinates,
} from './helpers';

/**
 * Marché : séquestre à la création, achat total ou partiel, taxe détruite, annulation et expiration avec
 * remboursement, concurrence sur la dernière quantité et conservation des stocks (seule la taxe disparaît).
 */
describe('API integration - marché', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let market: MarketService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    market = app.get(MarketService);
  });

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  const STOCK = { metal: 500_000, crystal: 300_000, deuterium: 200_000 };
  const player = async (stock: Partial<typeof STOCK> = {}) => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const planetId = me.body.planets[0].id as string;
    // sous la capacité de stockage de départ : le règlement de production ne rogne rien
    await database.planet.update({ where: { id: planetId }, data: { ...STOCK, ...stock } });
    return { token: accessToken as string, userId: me.body.id as string, planetId };
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const stock = async (u: Player) => {
    const p = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    return { metal: p.metal, crystal: p.crystal, deuterium: p.deuterium };
  };
  /** Somme d'une ressource chez les joueurs donnés, séquestre des offres actives compris. */
  const total = async (resource: 'metal' | 'crystal' | 'deuterium', players: Player[]) => {
    let sum = 0;
    for (const u of players) sum += (await stock(u))[resource];
    const escrow = await database.marketOffer.findMany({
      where: { active: true, giveResource: resource, sellerId: { in: players.map((u) => u.userId) } },
      select: { remaining: true },
    });
    return sum + escrow.reduce((s, o) => s + o.remaining, 0);
  };
  const offer = (u: Player, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/market/offers')
      .set(auth(u))
      .send({ planetId: u.planetId, give: 'metal', want: 'crystal', amount: 1000, rate: 1, ...body });
  const buy = (u: Player, offerId: string, amount: number, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer()).post(`/market/offers/${offerId}/buy`).set(auth(u)).send({ planetId: u.planetId, amount, ...body });

  describe('création', () => {
    it("met la ressource en séquestre, publie l'offre et la liste dans « mes offres »", async () => {
      const seller = await player();
      const before = await stock(seller);
      const res = await offer(seller, { amount: 1000, rate: 1.2, minAmount: 100 }).expect(201);
      expect(res.body).toMatchObject({ give: 'metal', want: 'crystal', amount: 1000, remaining: 1000, rate: 1.2, minAmount: 100, mine: true, active: true });
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + (MARKET_OFFER_HOURS - 1) * 3_600_000);
      expect((await stock(seller)).metal).toBe(before.metal - 1000);

      const mine = await request(app.getHttpServer()).get('/market/mine').set(auth(seller)).expect(200);
      expect(mine.body.offers.map((o: any) => o.id)).toContain(res.body.id);
      const listed = await request(app.getHttpServer()).get('/market/offers').query({ give: 'metal', want: 'crystal' }).set(auth(seller)).expect(200);
      expect(listed.body.offers.some((o: any) => o.id === res.body.id)).toBe(true);
    });

    it('refuse les entrées invalides sans rien débiter', async () => {
      const seller = await player();
      const other = await player();
      const before = await stock(seller);
      await offer(seller, { want: 'metal' }).expect(400); // même ressource
      await offer(seller, { give: 'energy' }).expect(400);
      await offer(seller, { rate: 0 }).expect(400);
      await offer(seller, { rate: 0.2 }).expect(400); // sous la moitié de la référence (1,5)
      await offer(seller, { rate: 4 }).expect(400); // au-dessus du double
      await offer(seller, { rate: 'beaucoup' }).expect(400);
      await offer(seller, { amount: 0 }).expect(400);
      await offer(seller, { amount: 1.5 }).expect(400);
      await offer(seller, { amount: -5 }).expect(400);
      await offer(seller, { amount: 100, minAmount: 200 }).expect(400);
      await offer(seller, { amount: 600_000 }).expect(400); // plus que le stock
      await offer(seller, { planetId: other.planetId }).expect(404); // planète étrangère
      expect(await stock(seller)).toEqual(before);
      expect(await database.marketOffer.count({ where: { sellerId: seller.userId } })).toBe(0);
    });

    it("limite le nombre d'offres actives par joueur", async () => {
      const seller = await player();
      for (let i = 0; i < MARKET_MAX_ACTIVE_OFFERS; i += 1) await offer(seller, { amount: 10 }).expect(201);
      const refused = await offer(seller, { amount: 10 }).expect(400);
      expect(refused.body.message).toMatch(/maximal/);
    });
  });

  describe('achat', () => {
    it("achat partiel : séquestre livré, paiement moins taxe au vendeur, historique, et seule la taxe disparaît", async () => {
      const seller = await player();
      const buyer = await player();
      const created = await offer(seller, { amount: 1000, rate: 1.2 }).expect(201);
      const metalBefore = await total('metal', [seller, buyer]);
      const crystalBefore = await total('crystal', [seller, buyer]);
      const s0 = await stock(seller);
      const b0 = await stock(buyer);

      const res = await buy(buyer, created.body.id, 400).expect(201);
      // 400 × 1,2 = 480 cristal ; taxe 5 % = 24
      expect(res.body).toMatchObject({ received: 400, give: 'metal', paid: 480, want: 'crystal', tax: 24, remaining: 600 });
      const s1 = await stock(seller);
      const b1 = await stock(buyer);
      expect(b1.metal).toBe(b0.metal + 400);
      expect(b1.crystal).toBe(b0.crystal - 480);
      expect(s1.crystal).toBe(s0.crystal + 456);
      expect(s1.metal).toBe(s0.metal);

      expect(await total('metal', [seller, buyer])).toBe(metalBefore);
      expect(await total('crystal', [seller, buyer])).toBe(crystalBefore - 24);
      const trade = await database.marketTrade.findFirstOrThrow({ where: { offerId: created.body.id } });
      expect(trade).toMatchObject({ buyerId: buyer.userId, sellerId: seller.userId, amount: 400, payment: 480, tax: 24, rate: 1.2 });
      expect((await database.marketOffer.findUniqueOrThrow({ where: { id: created.body.id } })).remaining).toBe(600);
    });

    it("la dernière quantité ferme l'offre, qui disparaît de la liste", async () => {
      const seller = await player();
      const buyer = await player();
      const created = await offer(seller, { amount: 300, rate: 1 }).expect(201);
      await buy(buyer, created.body.id, 300).expect(201);
      const row = await database.marketOffer.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(row).toMatchObject({ active: false, remaining: 0 });
      const listed = await request(app.getHttpServer()).get('/market/offers').set(auth(buyer)).expect(200);
      expect(listed.body.offers.some((o: any) => o.id === created.body.id)).toBe(false);
      await buy(buyer, created.body.id, 1).expect(409);
    });

    it('refuse sa propre offre, une quantité trop grande ou trop petite, et un acheteur sans fonds', async () => {
      const seller = await player();
      const buyer = await player({ crystal: 100 });
      const created = await offer(seller, { amount: 1000, rate: 1, minAmount: 50 }).expect(201);
      await buy(seller, created.body.id, 100).expect(400);
      await buy(buyer, created.body.id, 1001).expect(400);
      await buy(buyer, created.body.id, 10).expect(400); // sous le minimum
      await buy(buyer, created.body.id, 500).expect(400); // 500 cristal requis, 100 disponibles
      await buy(buyer, created.body.id, 1.5).expect(400);
      await buy(buyer, created.body.id, 0).expect(400);
      await buy(buyer, created.body.id, 50, { planetId: seller.planetId }).expect(404); // planète étrangère
      await buy(buyer, 'inconnue', 50).expect(404);
      expect(await stock(buyer)).toEqual({ ...STOCK, crystal: 100 });
      expect((await database.marketOffer.findUniqueOrThrow({ where: { id: created.body.id } })).remaining).toBe(1000);
      expect(await database.marketTrade.count({ where: { offerId: created.body.id } })).toBe(0);
    });

    it("le reliquat inférieur au minimum reste achetable en entier", async () => {
      const seller = await player();
      const buyer = await player();
      const created = await offer(seller, { amount: 120, rate: 1, minAmount: 100 }).expect(201);
      await buy(buyer, created.body.id, 100).expect(201);
      // il reste 20 (< 100) : on peut les prendre, mais pas moins
      await buy(buyer, created.body.id, 10).expect(400);
      await buy(buyer, created.body.id, 20).expect(201);
    });
  });

  describe('concurrence et conservation', () => {
    it("cinq acheteurs simultanés sur 100 unités : seules deux ventes de 40 passent, conservation exacte", async () => {
      const seller = await player();
      const buyers = await Promise.all([player(), player(), player(), player(), player()]);
      const created = await offer(seller, { amount: 100, rate: 1.2 }).expect(201);
      const all = [seller, ...buyers];
      const metalBefore = await total('metal', all);
      const crystalBefore = await total('crystal', all);

      const results = await Promise.all(buyers.map((b) => buy(b, created.body.id, 40)));
      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(2);
      for (const r of results.filter((r) => r.status !== 201)) expect([400, 409]).toContain(r.status);

      const row = await database.marketOffer.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(row.remaining).toBe(20);
      expect(await total('metal', all)).toBe(metalBefore);
      const tax = ok.reduce((sum, r) => sum + r.body.tax, 0);
      expect(await total('crystal', all)).toBe(crystalBefore - tax);
      expect(await database.marketTrade.count({ where: { offerId: created.body.id } })).toBe(2);
    });

    it("un même acheteur qui n'a des fonds que pour un achat ne peut pas en faire deux en parallèle", async () => {
      const seller = await player();
      const buyer = await player({ crystal: 1000 });
      const created = await offer(seller, { amount: 5000, rate: 1 }).expect(201);
      const results = await Promise.all([buy(buyer, created.body.id, 800), buy(buyer, created.body.id, 800)]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      const after = await stock(buyer);
      expect(after.crystal).toBe(200);
      expect(after.metal).toBe(STOCK.metal + 800);
    });

    it("annulation et achat simultanés : le séquestre n'est ni perdu ni dupliqué", async () => {
      const seller = await player();
      const buyer = await player();
      const created = await offer(seller, { amount: 1000, rate: 1 }).expect(201);
      const all = [seller, buyer];
      const metalBefore = (await total('metal', all)) + 0; // séquestre compris
      const [bought, cancelled] = await Promise.all([
        buy(buyer, created.body.id, 400),
        request(app.getHttpServer()).delete(`/market/offers/${created.body.id}`).set(auth(seller)),
      ]);
      expect([bought.status, cancelled.status].filter((s) => s === 201 || s === 200).length).toBeGreaterThanOrEqual(1);
      const row = await database.marketOffer.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(row.active).toBe(false);
      expect(row.remaining).toBe(0);
      // toutes les unités de métal sont chez l'un des deux joueurs (plus aucun séquestre)
      expect(await total('metal', all)).toBe(metalBefore);
      const tradeCount = await database.marketTrade.count({ where: { offerId: created.body.id } });
      expect(tradeCount).toBe(bought.status === 201 ? 1 : 0);
    });
  });

  describe('annulation, expiration et historique', () => {
    it('annuler rend le séquestre restant ; les autres joueurs ne peuvent pas annuler', async () => {
      const seller = await player();
      const other = await player();
      const created = await offer(seller, { amount: 700, rate: 1 }).expect(201);
      await buy(other, created.body.id, 200).expect(201);
      await request(app.getHttpServer()).delete(`/market/offers/${created.body.id}`).set(auth(other)).expect(404);
      const before = await stock(seller);
      await request(app.getHttpServer()).delete(`/market/offers/${created.body.id}`).set(auth(seller)).expect(200);
      expect((await stock(seller)).metal).toBe(before.metal + 500);
      await request(app.getHttpServer()).delete(`/market/offers/${created.body.id}`).set(auth(seller)).expect(409);
    });

    it('une offre expirée n’est plus achetable et la tâche planifiée rend le séquestre', async () => {
      const seller = await player();
      const buyer = await player();
      const created = await offer(seller, { amount: 900, rate: 1 }).expect(201);
      const before = await stock(seller);
      await database.marketOffer.update({ where: { id: created.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await buy(buyer, created.body.id, 100).expect(409);
      const listed = await request(app.getHttpServer()).get('/market/offers').set(auth(buyer)).expect(200);
      expect(listed.body.offers.some((o: any) => o.id === created.body.id)).toBe(false);

      expect(await market.expireDue()).toBeGreaterThanOrEqual(1);
      expect((await stock(seller)).metal).toBe(before.metal + 900);
      expect(await database.marketOffer.findUniqueOrThrow({ where: { id: created.body.id } })).toMatchObject({ active: false, remaining: 0 });
      // second passage : rien à rembourser deux fois
      await market.expireDue();
      expect((await stock(seller)).metal).toBe(before.metal + 900);
    });

    it("le remboursement va sur une autre planète du vendeur si la planète d'origine a disparu", async () => {
      const seller = await player();
      const colony = await createPlanetAtFreeCoordinates(
        database,
        { userId: seller.userId, name: 'Colonie', fieldsMax: 163, metal: 5000 },
        { galaxy: 8, system: [100, 399] },
      );
      const created = await request(app.getHttpServer())
        .post('/market/offers').set(auth(seller))
        .send({ planetId: colony.id, give: 'metal', want: 'crystal', amount: 1000, rate: 1 }).expect(201);
      const home = await stock(seller);
      await database.planet.delete({ where: { id: colony.id } });
      await database.marketOffer.update({ where: { id: created.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await market.expireDue();
      expect((await stock(seller)).metal).toBe(home.metal + 1000);
    });

    it("l'historique donne le dernier taux et le taux moyen pondéré par les quantités", async () => {
      const seller = await player({ deuterium: 600_000 });
      const buyer = await player({ metal: 900_000 });
      const first = await offer(seller, { give: 'deuterium', want: 'metal', amount: 1000, rate: 3 }).expect(201);
      const second = await offer(seller, { give: 'deuterium', want: 'metal', amount: 1000, rate: 4 }).expect(201);
      await buy(buyer, first.body.id, 300).expect(201); // 300 à 3
      await buy(buyer, second.body.id, 100).expect(201); // 100 à 4
      const history = await request(app.getHttpServer()).get('/market/history').query({ give: 'deuterium', want: 'metal' }).set(auth(buyer)).expect(200);
      expect(history.body.lastRate).toBe(4);
      expect(history.body.averageRate).toBe(3.25);
      expect(history.body.bounds).toEqual({ min: 1.5, max: 6 });
      expect(history.body.trades.length).toBeGreaterThanOrEqual(2);
      await request(app.getHttpServer()).get('/market/history').query({ give: 'metal', want: 'metal' }).set(auth(buyer)).expect(400);
      const mine = await request(app.getHttpServer()).get('/market/mine').set(auth(seller)).expect(200);
      // 300 × 3 = 900 moins 45 de taxe = 855 ; 100 × 4 = 400 moins 20 = 380
      const received = mine.body.trades.filter((t: any) => t.role === 'seller').map((t: any) => t.received).sort();
      expect(received).toEqual([380, 855]);
    });
  });
});
