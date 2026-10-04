import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

/**
 * GAME-01 — validation des missions de flotte : liste autorisée, bornes, quantités entières,
 * règles de cible. Tout refus doit survenir sans débit de ressources ni de vaisseaux.
 */
describe('API integration - Validation des flottes et missions (GAME-01)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const usernames: string[] = [];

  let token: string;
  let planetId: string;
  let origin: { galaxy: number; system: number; position: number };
  let ownSecond: { galaxy: number; system: number; position: number };
  let other: { galaxy: number; system: number; position: number };

  const STOCK = 1_000_000;

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const base = (over: Record<string, unknown> = {}) => ({
    planetId,
    toGalaxy: other.galaxy,
    toSystem: other.system,
    toPosition: other.position,
    mission: 3,
    speedPercent: 100,
    ships: { '202': 2 },
    cargo: { metal: 10, crystal: 0, deuterium: 0 },
    ...over,
  });

  const snapshot = async () => {
    const planet = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    const ship = await database.ship.findUniqueOrThrow({
      where: { planetId_shipId: { planetId, shipId: 202 } },
    });
    const fleets = await database.fleet.count({ where: { user: { username: usernames[0] } } });
    return { metal: planet.metal, crystal: planet.crystal, deuterium: planet.deuterium, ships: ship.amount, fleets };
  };

  const expectRefused = async (body: Record<string, unknown>) => {
    const before = await snapshot();
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await snapshot()).toEqual(before);
    return res;
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;

    const user = buildTestUser();
    usernames.push(user.username);
    const session = await registerAndLogin(app, user);
    token = session.accessToken;
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    planetId = me.body.planets[0].id;
    origin = me.body.planets[0];

    // Deuxième planète du joueur et planète d'un adversaire, à des positions libres
    const free = (g: number, s: number) => ({ galaxy: g, system: s, position: 15 });
    ownSecond = free(origin.galaxy, ((origin.system + 5) % 499) + 1);
    await database.planet.create({
      data: { userId: me.body.id, name: 'Seconde', ...ownSecond },
    });

    const rival = buildTestUser();
    usernames.push(rival.username);
    const rivalSession = await registerAndLogin(app, rival);
    const rivalMe = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${rivalSession.accessToken}`)
      .expect(200);
    other = rivalMe.body.planets[0];

    await database.planet.update({
      where: { id: planetId },
      data: { metal: STOCK, crystal: STOCK, deuterium: STOCK, lastUpdate: new Date() },
    });
    await database.ship.upsert({
      where: { planetId_shipId: { planetId, shipId: 202 } },
      update: { amount: 50 },
      create: { planetId, shipId: 202, amount: 50 },
    });
  });

  afterAll(async () => {
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  describe('missions', () => {
    it.each([8, 9, 15, 999, 0, -1, 3.5])('refuse la mission %p sans débit', async (mission) => {
      await expectRefused(base({ mission }));
    });

    it('refuse une mission non numérique', async () => {
      await expectRefused(base({ mission: '3' }));
      await expectRefused(base({ mission: null }));
    });
  });

  describe('coordonnées', () => {
    it.each([
      { toGalaxy: 0 },
      { toGalaxy: 10 },
      { toSystem: 0 },
      { toSystem: 500 },
      { toPosition: 0 },
      { toPosition: 16 },
      { toSystem: 1.5 },
      { toGalaxy: '1' },
    ])('refuse %j', async (override) => {
      await expectRefused(base(override));
    });
  });

  describe('vaisseaux', () => {
    it.each([
      ['vaisseau inconnu', { '9999': 1 }],
      ['quantité fractionnaire', { '202': 1.5 }],
      ['quantité négative', { '202': -2 }],
      ['quantité nulle seule', { '202': 0 }],
      ['quantité textuelle', { '202': '2' }],
      ['quantité démesurée', { '202': 1e15 }],
      ['identifiant non numérique', { abc: 1 }],
      ['liste vide', {}],
    ])('refuse %s', async (_label, ships) => {
      await expectRefused(base({ ships }));
    });

    it('refuse une liste fournie sous forme de tableau', async () => {
      await expectRefused(base({ ships: [202, 2] }));
    });

    it('refuse plus de vaisseaux que disponibles', async () => {
      await expectRefused(base({ ships: { '202': 51 } }));
    });
  });

  describe('cargaison', () => {
    it.each([
      ['négative', { metal: -1 }],
      ['fractionnaire', { metal: 1.5 }],
      ['textuelle', { metal: '10' }],
      ['démesurée', { metal: 1e15 }],
      ['clé inconnue', { or: 10 }],
    ])('refuse une cargaison %s', async (_label, cargo) => {
      await expectRefused(base({ cargo }));
    });

    it('refuse un dépassement de capacité', async () => {
      await expectRefused(base({ ships: { '202': 1 }, cargo: { metal: 1_000_000 } }));
    });
  });

  describe('règles de cible', () => {
    it('refuse la planète d\'origine comme destination', async () => {
      await expectRefused(
        base({ toGalaxy: origin.galaxy, toSystem: origin.system, toPosition: origin.position }),
      );
    });

    it('refuse un transport vers une position sans planète', async () => {
      await expectRefused(base({ toGalaxy: 9, toSystem: 499, toPosition: 14 }));
    });

    it('refuse une attaque vers une position sans planète', async () => {
      await expectRefused(base({ mission: 1, toGalaxy: 9, toSystem: 499, toPosition: 14 }));
    });

    it('refuse d\'attaquer sa propre planète', async () => {
      await expectRefused(
        base({ mission: 1, toGalaxy: ownSecond.galaxy, toSystem: ownSecond.system, toPosition: ownSecond.position }),
      );
    });

    it('refuse un déploiement vers la planète d\'un autre joueur', async () => {
      await expectRefused(base({ mission: 4 }));
    });
  });

  describe('envois valides', () => {
    it('accepte un transport vers une planète existante, avec débit', async () => {
      const before = await snapshot();
      await post(base()).expect(201);
      const after = await snapshot();
      expect(after.ships).toBe(before.ships - 2);
      expect(after.fleets).toBe(before.fleets + 1);
      expect(after.metal).toBeLessThan(before.metal);
    });

    it('accepte une attaque contre une planète adverse', async () => {
      await post(base({ mission: 1, cargo: {} })).expect(201);
    });

    it('accepte un déploiement vers sa propre planète', async () => {
      await post(
        base({
          mission: 4,
          toGalaxy: ownSecond.galaxy,
          toSystem: ownSecond.system,
          toPosition: ownSecond.position,
          cargo: {},
        }),
      ).expect(201);
    });
  });
});
