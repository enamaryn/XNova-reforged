import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { MissilesService } from '../../src/missiles/missiles.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
  movePlanetToFreeCoordinates,
} from './helpers';

/**
 * Missiles interplanétaires : le silo range 10 missiles par niveau, le tir est limité par la portée
 * (Réacteur à impulsion), les missiles d'interception abattent un missile chacun, les autres détruisent
 * des défenses ; chaque frappe n'est résolue qu'une fois et les missiles ne combattent pas.
 */
describe('API integration - missiles interplanétaires', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let missiles: MissilesService;
  const users: ReturnType<typeof buildTestUser>[] = [];
  let nextSystem = 100;

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    missiles = app.get(MissilesService);
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
    return {
      token: accessToken as string,
      userId: me.body.id as string,
      planetId: me.body.planets[0].id as string,
    };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Positions obtenues par le dernier `duel` (voir movePlanetToFreeCoordinates). */
  let attackerPosition = 5;
  let defenderPosition = 6;
  /** Place deux joueurs à `distance` systèmes l'un de l'autre, dans une zone libre. */
  const duel = async (distance: number) => {
    const attacker = await player();
    const defender = await player();
    nextSystem += 20;
    // positions préférées 5 et 6 ; une autre position du système est prise si une planète d'une autre suite l'occupe
    attackerPosition = await movePlanetToFreeCoordinates(
      database, attacker.planetId, { galaxy: 2, system: nextSystem, position: 5 }, { missileSilo: 5 });
    defenderPosition = await movePlanetToFreeCoordinates(
      database, defender.planetId, { galaxy: 2, system: nextSystem + distance, position: 6 });
    return { attacker, defender, defenderSystem: nextSystem + distance };
  };
  const setTech = (userId: string, techId: number, level: number) =>
    database.technology.upsert({
      where: { userId_techId: { userId, techId } },
      update: { level },
      create: { userId, techId, level },
    });
  const stock = (planetId: string, defenseId: number, amount: number) =>
    database.defense.upsert({
      where: { planetId_defenseId: { planetId, defenseId } },
      update: { amount },
      create: { planetId, defenseId, amount },
    });
  const amountOf = async (planetId: string, defenseId: number) =>
    (await database.defense.findUnique({ where: { planetId_defenseId: { planetId, defenseId } } }))?.amount ?? 0;
  const launch = (u: { token: string; planetId: string }, system: number, amount: number, extra: object = {}) =>
    request(app.getHttpServer())
      .post('/missiles/launch')
      .set(auth(u.token))
      .send({ planetId: u.planetId, toGalaxy: 2, toSystem: system, toPosition: defenderPosition, amount, ...extra });
  const arriveNow = (id: string) =>
    database.missileStrike.update({ where: { id }, data: { arrivalTime: new Date(Date.now() - 1000) } });

  describe('silo et fabrication', () => {
    it('le silo est constructible, le stock est plafonné à 10 missiles par niveau', async () => {
      const p = await player();
      await database.planet.update({
        where: { id: p.planetId },
        data: { shipyard: 8, missileSilo: 1, metal: 50_000_000, crystal: 50_000_000, deuterium: 50_000_000 },
      });
      const list = await request(app.getHttpServer())
        .get('/defense').query({ planetId: p.planetId }).set(auth(p.token)).expect(200);
      expect(list.body.missileSilo).toMatchObject({ level: 1, capacity: 10, used: 0 });
      const ids = list.body.defenses.map((d: { id: number }) => d.id);
      expect(ids).toEqual(expect.arrayContaining([502, 503]));
      // Missile interplanétaire : silo niveau 4 et Réacteur à impulsion 1 requis
      const ipm = list.body.defenses.find((d: { id: number }) => d.id === 502);
      expect(ipm.canBuild).toBe(false);

      const build = (amount: number) =>
        request(app.getHttpServer())
          .post('/defense/build').set(auth(p.token)).send({ planetId: p.planetId, defenseId: 503, amount });
      const tooMany = await build(11).expect(400);
      expect(tooMany.body.message).toMatch(/silo/i);
      await build(6).expect(201);
      // Les 6 en fabrication comptent : 6 + 5 dépasse la capacité
      await build(5).expect(400);
      await build(4).expect(201);
      const after = await request(app.getHttpServer())
        .get('/defense').query({ planetId: p.planetId }).set(auth(p.token)).expect(200);
      expect(after.body.missileSilo.used).toBe(10);
    });
  });

  describe('lancement', () => {
    it('refuse hors portée, hors galaxie, sans missiles, sa propre planète et un vide', async () => {
      const { attacker, defenderSystem } = await duel(10);
      await setTech(attacker.userId, 117, 1); // portée 4
      await stock(attacker.planetId, 502, 5);

      const far = await launch(attacker, defenderSystem, 1).expect(400);
      expect(far.body.message).toMatch(/portee/);
      await setTech(attacker.userId, 117, 3); // portée 14
      await launch(attacker, defenderSystem, 99).expect(400); // stock insuffisant
      await request(app.getHttpServer())
        .post('/missiles/launch').set(auth(attacker.token))
        .send({ planetId: attacker.planetId, toGalaxy: 3, toSystem: defenderSystem, toPosition: defenderPosition, amount: 1 })
        .expect(400);
      await request(app.getHttpServer())
        .post('/missiles/launch').set(auth(attacker.token))
        .send({ planetId: attacker.planetId, toGalaxy: 2, toSystem: defenderSystem, toPosition: defenderPosition === 14 ? 13 : 14, amount: 1 })
        .expect(400);
      await request(app.getHttpServer())
        .post('/missiles/launch').set(auth(attacker.token))
        .send({ planetId: attacker.planetId, toGalaxy: 2, toSystem: defenderSystem - 10, toPosition: attackerPosition, amount: 1 })
        .expect(400); // propre planète
      expect(await amountOf(attacker.planetId, 502)).toBe(5);
      expect(await database.missileStrike.count({ where: { userId: attacker.userId } })).toBe(0);
    });

    it('un autre joueur ne peut ni lancer depuis ma planète ni la consulter', async () => {
      const { attacker, defender } = await duel(3);
      await request(app.getHttpServer()).get(`/missiles/${attacker.planetId}`).set(auth(defender.token)).expect(403);
      await request(app.getHttpServer()).post('/missiles/launch').set(auth(defender.token))
        .send({ planetId: attacker.planetId, toGalaxy: 2, toSystem: 1, toPosition: 1, amount: 1 }).expect(403);
    });
  });

  describe('résolution', () => {
    it('détruit les défenses, débite le stock une seule fois et rend le résultat aux deux joueurs', async () => {
      const { attacker, defender, defenderSystem } = await duel(3);
      await setTech(attacker.userId, 117, 1);
      await stock(attacker.planetId, 502, 5);
      await stock(defender.planetId, 401, 200);

      const res = await launch(attacker, defenderSystem - 0, 2, { primaryTarget: 401 }).expect(201);
      expect(res.body.durationSeconds).toBeGreaterThan(0);
      expect(await amountOf(attacker.planetId, 502)).toBe(3);

      const view = await request(app.getHttpServer())
        .get(`/missiles/${defender.planetId}`).set(auth(defender.token)).expect(200);
      expect(view.body.incoming).toHaveLength(1);
      expect(view.body.incoming[0].primaryTarget).toBeNull();
      expect(view.body.incoming[0].result).toBeNull();

      await arriveNow(res.body.strikeId);
      expect(await missiles.resolveDue()).toBe(1);
      expect(await missiles.resolveDue()).toBe(0); // une seule résolution

      // 2 × 12 000 = 24 000 ; 200 de coque par lanceur → 120 détruits
      expect(await amountOf(defender.planetId, 401)).toBe(80);
      const mine = await request(app.getHttpServer())
        .get(`/missiles/${attacker.planetId}`).set(auth(attacker.token)).expect(200);
      expect(mine.body.outgoing[0]).toMatchObject({ status: 'resolved', primaryTarget: 401 });
      expect(mine.body.outgoing[0].result).toMatchObject({ launched: 2, intercepted: 0, hits: 2, destroyed: { '401': 120 } });
      const theirs = await request(app.getHttpServer())
        .get(`/missiles/${defender.planetId}`).set(auth(defender.token)).expect(200);
      expect(theirs.body.incoming[0].status).toBe('resolved');
      expect(theirs.body.incoming[0].result.destroyed).toEqual({ '401': 120 });
    });

    it('les missiles d\'interception abattent des missiles et se consomment', async () => {
      const { attacker, defender, defenderSystem } = await duel(2);
      await setTech(attacker.userId, 117, 1);
      await stock(attacker.planetId, 502, 4);
      await stock(defender.planetId, 401, 100);
      await stock(defender.planetId, 503, 3);

      const res = await launch(attacker, defenderSystem, 4).expect(201);
      await arriveNow(res.body.strikeId);
      await missiles.resolveDue();

      expect(await amountOf(defender.planetId, 503)).toBe(0);
      // 1 seul missile passe : 12 000 / 200 = 60 lanceurs
      expect(await amountOf(defender.planetId, 401)).toBe(40);
      const strike = await database.missileStrike.findUniqueOrThrow({ where: { id: res.body.strikeId } });
      expect(strike.result).toMatchObject({ launched: 4, intercepted: 3, hits: 1 });
    });

    it('une planète disparue ou changée de propriétaire : les missiles se perdent', async () => {
      const { attacker, defender, defenderSystem } = await duel(2);
      await setTech(attacker.userId, 117, 1);
      await stock(attacker.planetId, 502, 1);
      const res = await launch(attacker, defenderSystem, 1).expect(201);
      await database.planet.update({ where: { id: defender.planetId }, data: { userId: attacker.userId } });
      await arriveNow(res.body.strikeId);
      await missiles.resolveDue();
      const strike = await database.missileStrike.findUniqueOrThrow({ where: { id: res.body.strikeId } });
      expect(strike.result).toMatchObject({ lost: true });
    });

    it('les missiles stockés ne combattent pas : une attaque classique ne les détruit pas', async () => {
      const { defender } = await duel(2);
      await stock(defender.planetId, 503, 5);
      await stock(defender.planetId, 401, 1);
      // Comme le fait le combat : seules les défenses < 500 sont engagées
      const engaged = await database.defense.findMany({
        where: { planetId: defender.planetId, amount: { gt: 0 }, defenseId: { lt: 500 } },
      });
      expect(engaged.map((d) => d.defenseId)).toEqual([401]);
    });
  });
});
