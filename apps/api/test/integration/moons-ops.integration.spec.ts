import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
  createPlanetAtFreeCoordinates,
  movePlanetToFreeCoordinates,
} from './helpers';

/**
 * Lunes (2e partie) : la phalange scrute les mouvements de flotte autour d'une planète à portée
 * (niveau² − 1 systèmes, coût en deutérium) ; la porte de saut transfère des vaisseaux entre deux lunes
 * équipées, puis recharge les deux portes.
 */
describe('API integration - phalange et porte de saut', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: ReturnType<typeof buildTestUser>[] = [];
  let nextSystem = 60;

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  const player = async () => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return { token: accessToken as string, userId: me.body.id as string, planetId: me.body.planets[0].id as string };
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });

  /** Place la planète du joueur dans une zone libre de la galaxie 4. */
  const place = async (u: Player, system: number, position = 5) => {
    const placed = await movePlanetToFreeCoordinates(database, u.planetId, { galaxy: 4, system, position });
    return { galaxy: 4, system, position: placed };
  };
  const moonOf = (u: Player, c: { galaxy: number; system: number; position: number }, extra: object = {}) =>
    database.planet.create({
      data: {
        userId: u.userId, name: 'Lune', ...c, isMoon: true, planetType: 'moon',
        metal: 0, crystal: 0, deuterium: 20000, fieldsMax: 10, fieldsUsed: 0, ...extra,
      },
    });
  const fleetRow = (userId: string, from: any, to: any, over: object = {}) =>
    database.fleet.create({
      data: {
        userId,
        fromGalaxy: from.galaxy, fromSystem: from.system, fromPosition: from.position,
        toGalaxy: to.galaxy, toSystem: to.system, toPosition: to.position,
        mission: 1, ships: { '204': 7, '206': 3 }, cargo: {},
        startTime: new Date(), arrivalTime: new Date(Date.now() + 600_000),
        returnTime: new Date(Date.now() + 1_200_000), status: 'traveling', ...over,
      } as any,
    });

  describe('phalange de capteur', () => {
    it('liste les flottes qui partent de la cible, y arrivent ou y reviennent, et débite le deutérium', async () => {
      const watcher = await player();
      const victim = await player();
      const attacker = await player();
      nextSystem += 30;
      const mine = await place(watcher, nextSystem);
      const target = await place(victim, nextSystem + 2, 8);
      const far = await place(attacker, nextSystem + 20, 3);
      const moon = await moonOf(watcher, mine, { phalanx: 2, moonBase: 1 }); // portée 3

      await fleetRow(victim.userId, target, far, { mission: 3 });                        // part de la cible
      await fleetRow(attacker.userId, far, target, { mission: 1 });                      // arrive sur la cible
      await fleetRow(victim.userId, target, far, { mission: 3, status: 'returning' });   // revient à la cible
      await fleetRow(victim.userId, far, mine, { mission: 3 });                          // sans rapport avec la cible

      const res = await request(app.getHttpServer())
        .post(`/moons/${moon.id}/phalanx`).set(auth(watcher)).send(target).expect(201);
      expect(res.body.cost).toBe(5000);
      expect(res.body.movements).toHaveLength(3);
      expect(res.body.movements.map((m: { direction: string }) => m.direction).sort())
        .toEqual(['inbound', 'outbound', 'returning']);
      expect(res.body.movements[0]).toMatchObject({ ships: 10 });
      // Aucun identifiant ni nom de joueur dans la réponse
      expect(JSON.stringify(res.body)).not.toContain(victim.userId);

      const after = await database.planet.findUniqueOrThrow({ where: { id: moon.id } });
      expect(after.deuterium).toBe(15000);
    });

    it('refuse hors portée, hors galaxie, sans phalange, sa propre planète, sans deutérium', async () => {
      const watcher = await player();
      const other = await player();
      nextSystem += 30;
      const mine = await place(watcher, nextSystem);
      const near = await place(other, nextSystem + 5);
      const moon = await moonOf(watcher, mine, { phalanx: 2 }); // portée 3

      const range = await request(app.getHttpServer())
        .post(`/moons/${moon.id}/phalanx`).set(auth(watcher)).send(near).expect(400);
      expect(range.body.message).toMatch(/portee/);
      await request(app.getHttpServer())
        .post(`/moons/${moon.id}/phalanx`).set(auth(watcher))
        .send({ ...near, galaxy: 5 }).expect(400);

      await database.planet.update({ where: { id: moon.id }, data: { phalanx: 3 } }); // portée 8
      await request(app.getHttpServer())
        .post(`/moons/${moon.id}/phalanx`).set(auth(watcher)).send(mine).expect(400); // propre planète
      await database.planet.update({ where: { id: moon.id }, data: { deuterium: 100 } });
      const poor = await request(app.getHttpServer())
        .post(`/moons/${moon.id}/phalanx`).set(auth(watcher)).send(near).expect(400);
      expect(poor.body.message).toMatch(/insuffisant/i);
      expect((await database.planet.findUniqueOrThrow({ where: { id: moon.id } })).deuterium).toBe(100);

      await database.planet.update({ where: { id: moon.id }, data: { phalanx: 0, deuterium: 20000 } });
      await request(app.getHttpServer())
        .post(`/moons/${moon.id}/phalanx`).set(auth(watcher)).send(near).expect(400);
    });

    it('refuse une planète (pas une lune) et la lune d\'un autre joueur', async () => {
      const a = await player();
      const b = await player();
      nextSystem += 30;
      const ca = await place(a, nextSystem);
      const cb = await place(b, nextSystem + 1);
      const moonB = await moonOf(b, cb, { phalanx: 2 });
      await request(app.getHttpServer())
        .post(`/moons/${a.planetId}/phalanx`).set(auth(a)).send(cb).expect(400);
      await request(app.getHttpServer())
        .post(`/moons/${moonB.id}/phalanx`).set(auth(a)).send(ca).expect(403);
      await request(app.getHttpServer()).get(`/moons/${moonB.id}`).set(auth(a)).expect(403);
    });
  });

  describe('porte de saut', () => {
    it('transfère des vaisseaux instantanément et recharge les deux portes', async () => {
      const u = await player();
      nextSystem += 30;
      const c1 = await place(u, nextSystem);
      const m1 = await moonOf(u, c1, { jumpGate: 1 });
      const colony = await createPlanetAtFreeCoordinates(
        database, { userId: u.userId, name: 'Colonie', fieldsMax: 163 }, { galaxy: 4, system: [nextSystem + 9, nextSystem + 9] });
      const m2 = await moonOf(u, { galaxy: 4, system: colony.system, position: colony.position }, { jumpGate: 2 });
      await database.ship.create({ data: { planetId: m1.id, shipId: 202, amount: 10 } });
      await database.ship.create({ data: { planetId: m1.id, shipId: 206, amount: 4 } });

      const view = await request(app.getHttpServer()).get(`/moons/${m1.id}`).set(auth(u)).expect(200);
      expect(view.body.jumpGate.destinations.map((d: { id: string }) => d.id)).toEqual([m2.id]);

      const res = await request(app.getHttpServer())
        .post(`/moons/${m1.id}/jump`).set(auth(u))
        .send({ toMoonId: m2.id, ships: { '202': 6, '206': 4 } }).expect(201);
      expect(res.body.cooldownSeconds).toBeGreaterThanOrEqual(10);

      const amount = async (planetId: string, shipId: number) =>
        (await database.ship.findUnique({ where: { planetId_shipId: { planetId, shipId } } }))?.amount ?? 0;
      expect(await amount(m1.id, 202)).toBe(4);
      expect(await amount(m1.id, 206)).toBe(0);
      expect(await amount(m2.id, 202)).toBe(6);
      expect(await amount(m2.id, 206)).toBe(4);
      const rows = await database.planet.findMany({ where: { id: { in: [m1.id, m2.id] } } });
      for (const row of rows) expect(row.jumpGateReadyAt!.getTime()).toBeGreaterThan(Date.now());

      // Recharge : un second saut, dans les deux sens, est refusé sans rien déplacer
      const again = await request(app.getHttpServer())
        .post(`/moons/${m2.id}/jump`).set(auth(u))
        .send({ toMoonId: m1.id, ships: { '202': 1 } }).expect(400);
      expect(again.body.message).toMatch(/recharge/);
      expect(await amount(m2.id, 202)).toBe(6);

      // Une fois la recharge écoulée, le saut est de nouveau possible
      await database.planet.updateMany({ where: { id: { in: [m1.id, m2.id] } }, data: { jumpGateReadyAt: new Date(Date.now() - 1000) } });
      await request(app.getHttpServer())
        .post(`/moons/${m2.id}/jump`).set(auth(u))
        .send({ toMoonId: m1.id, ships: { '202': 1 } }).expect(201);
      expect(colony.id).toBeDefined();
    });

    it('refuse sans porte, vers soi-même, vers la lune d\'autrui, satellites, stock insuffisant, vide', async () => {
      const u = await player();
      const stranger = await player();
      nextSystem += 30;
      const c1 = await place(u, nextSystem);
      const cs = await place(stranger, nextSystem + 1);
      const m1 = await moonOf(u, c1, { jumpGate: 1 });
      const ms = await moonOf(stranger, cs, { jumpGate: 1 });
      const colony2 = await createPlanetAtFreeCoordinates(
        database, { userId: u.userId, name: 'Colonie', fieldsMax: 163 }, { galaxy: 4, system: [nextSystem + 5, nextSystem + 5] });
      const m2 = await moonOf(u, { galaxy: 4, system: colony2.system, position: colony2.position }, { jumpGate: 0 });
      await database.ship.create({ data: { planetId: m1.id, shipId: 202, amount: 3 } });
      await database.ship.create({ data: { planetId: m1.id, shipId: 212, amount: 3 } });
      const jump = (to: string, ships: object) =>
        request(app.getHttpServer()).post(`/moons/${m1.id}/jump`).set(auth(u)).send({ toMoonId: to, ships });

      await jump(m2.id, { '202': 1 }).expect(400);                  // pas de porte à l'arrivée
      await database.planet.update({ where: { id: m2.id }, data: { jumpGate: 1 } });
      await jump(m1.id, { '202': 1 }).expect(400);                  // vers soi-même
      await jump(ms.id, { '202': 1 }).expect(403);                  // lune d'un autre joueur
      await jump(m2.id, { '212': 1 }).expect(400);                  // satellite solaire
      await jump(m2.id, { '202': 99 }).expect(400);                 // stock insuffisant
      await jump(m2.id, { '202': 0 }).expect(400);                  // rien à envoyer
      await jump(m2.id, { '9999': 1 }).expect(400);                 // vaisseau inconnu
      await request(app.getHttpServer()).post(`/moons/${u.planetId}/jump`).set(auth(u))
        .send({ toMoonId: m2.id, ships: { '202': 1 } }).expect(400); // départ depuis une planète
      const left = await database.ship.findUnique({ where: { planetId_shipId: { planetId: m1.id, shipId: 202 } } });
      expect(left?.amount).toBe(3);
      expect((await database.planet.findUniqueOrThrow({ where: { id: m1.id } })).jumpGateReadyAt).toBeNull();
    });
  });
});
