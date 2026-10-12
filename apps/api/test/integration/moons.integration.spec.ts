import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { CombatService } from '../../src/combat/combat.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { BuildingsService } from '../../src/buildings/buildings.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Lunes : un combat sur une planète peut en laisser une (selon les débris), la lune partage les coordonnées
 * de sa planète, ne produit rien, ne construit que ses bâtiments, et les flottes peuvent partir de la lune
 * ou la viser (transport, déploiement, espionnage, attaque).
 */
describe('API integration - lunes', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;
  let buildings: BuildingsService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);
    buildings = app.get(BuildingsService);
  });

  afterEach(() => jest.restoreAllMocks());

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
      planet: me.body.planets[0] as { galaxy: number; system: number; position: number },
    };
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const coords = (u: Player) => ({
    galaxy: u.planet.galaxy,
    system: u.planet.system,
    position: u.planet.position,
  });
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const past = (s: number) => new Date(Date.now() - s * 1000);
  const addMoon = (u: Player, resources = { metal: 0, crystal: 0, deuterium: 0 }) =>
    database.planet.create({
      data: {
        userId: u.userId,
        name: 'Lune',
        ...coords(u),
        isMoon: true,
        planetType: 'moon',
        ...resources,
        fieldsMax: 1,
        fieldsUsed: 0,
      },
    });
  const shipsOn = async (planetId: string, shipId = 202) =>
    (await database.ship.findUnique({ where: { planetId_shipId: { planetId, shipId } } }))?.amount ?? 0;
  const send = (u: Player, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set(auth(u))
      .send({ speedPercent: 100, cargo: {}, ...body });
  const makeDue = (fleetId: string) =>
    database.fleet.update({ where: { id: fleetId }, data: { arrivalTime: past(60), returnTime: past(10) } });

  /** Attaque d'un joueur fortement armé contre 400 chasseurs légers : plus de 100 000 de débris. */
  const bigBattle = async () => {
    const attacker = await player();
    const defender = await player();
    await database.ship.create({ data: { planetId: defender.planetId, shipId: 204, amount: 400 } });
    await database.ship.create({ data: { planetId: attacker.planetId, shipId: 206, amount: 300 } });
    const fleet = await database.fleet.create({
      data: {
        userId: attacker.userId,
        fromGalaxy: attacker.planet.galaxy,
        fromSystem: attacker.planet.system,
        fromPosition: attacker.planet.position,
        toGalaxy: defender.planet.galaxy,
        toSystem: defender.planet.system,
        toPosition: defender.planet.position,
        mission: 1,
        ships: { '206': 300 },
        cargo: {},
        startTime: past(120),
        arrivalTime: past(60),
        returnTime: past(10),
        status: 'traveling',
      } as any,
    });
    return { attacker, defender, fleet };
  };
  const cleanDebris = (u: Player) =>
    database.debrisField.deleteMany({
      where: { galaxy: u.planet.galaxy, system: u.planet.system, position: u.planet.position },
    });

  describe('création après un combat', () => {
    it('crée la lune du défenseur aux mêmes coordonnées quand le tirage réussit, une seule fois', async () => {
      const roll = jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(true);
      const { defender, attacker } = await bigBattle();

      await fleetCron.processArrivals();

      expect(roll).toHaveBeenCalledTimes(1);
      // 400 chasseurs légers détruits → bien plus de 100 000 de débris → chance ≥ 1 %
      expect(roll.mock.calls[0][0]).toBeGreaterThanOrEqual(1);
      const moon = await database.planet.findFirstOrThrow({
        where: { ...coords(defender), isMoon: true },
      });
      expect(moon).toMatchObject({
        userId: defender.userId,
        planetType: 'moon',
        name: 'Lune',
        fieldsMax: 1,
        fieldsUsed: 0,
        metal: 0,
        crystal: 0,
        deuterium: 0,
      });
      const report = await database.combatReport.findFirstOrThrow({
        where: { attackerId: attacker.userId, defenderId: defender.userId },
      });
      expect(report.moonCreated).toBe(true);

      // La lune est listée parmi les planètes du défenseur, derrière la planète principale
      const me = await request(app.getHttpServer()).get('/auth/me').set(auth(defender)).expect(200);
      expect(me.body.planets.map((p: { isMoon: boolean }) => p.isMoon)).toEqual([false, true]);
      // Et visible dans la galaxie
      const view = await request(app.getHttpServer())
        .get(`/galaxy/${defender.planet.galaxy}/${defender.planet.system}`)
        .set(auth(attacker))
        .expect(200);
      const slot = view.body.positions.find((p: { position: number }) => p.position === defender.planet.position);
      expect(slot.hasMoon).toBe(true);
      expect(slot.moon).toMatchObject({ id: moon.id, name: 'Lune' });

      // Un second combat ne crée pas de deuxième lune
      await database.fleet.create({
        data: {
          userId: attacker.userId,
          fromGalaxy: attacker.planet.galaxy,
          fromSystem: attacker.planet.system,
          fromPosition: attacker.planet.position,
          toGalaxy: defender.planet.galaxy,
          toSystem: defender.planet.system,
          toPosition: defender.planet.position,
          mission: 1,
          ships: { '206': 1 },
          cargo: {},
          startTime: past(120),
          arrivalTime: past(60),
          returnTime: past(10),
          status: 'traveling',
        } as any,
      });
      await fleetCron.processArrivals();
      expect(await database.planet.count({ where: { ...coords(defender), isMoon: true } })).toBe(1);
      await cleanDebris(defender);
    });

    it('pas de lune quand le tirage échoue, ni quand les débris sont trop faibles pour une chance', async () => {
      const roll = jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const { defender } = await bigBattle();
      await fleetCron.processArrivals();
      expect(roll).toHaveBeenCalledTimes(1);
      expect(await database.planet.count({ where: { ...coords(defender), isMoon: true } })).toBe(0);
      await cleanDebris(defender);

      roll.mockClear().mockReturnValue(true);
      const attacker = await player();
      const small = await player();
      await database.ship.create({ data: { planetId: small.planetId, shipId: 204, amount: 2 } });
      await database.fleet.create({
        data: {
          userId: attacker.userId,
          fromGalaxy: attacker.planet.galaxy,
          fromSystem: attacker.planet.system,
          fromPosition: attacker.planet.position,
          toGalaxy: small.planet.galaxy,
          toSystem: small.planet.system,
          toPosition: small.planet.position,
          mission: 1,
          ships: { '206': 5 },
          cargo: {},
          startTime: past(120),
          arrivalTime: past(60),
          returnTime: past(10),
          status: 'traveling',
        } as any,
      });
      await database.ship.create({ data: { planetId: attacker.planetId, shipId: 206, amount: 5 } });
      await fleetCron.processArrivals();
      expect(roll).not.toHaveBeenCalled();
      expect(await database.planet.count({ where: { ...coords(small), isMoon: true } })).toBe(0);
      await cleanDebris(small);
    });
  });

  describe('la lune ne produit rien et construit ses propres bâtiments', () => {
    it('aucun revenu de base, même après une heure', async () => {
      const u = await player();
      const moon = await addMoon(u);
      await database.planet.update({ where: { id: moon.id }, data: { lastUpdate: past(3600) } });
      const res = await request(app.getHttpServer())
        .get(`/planets/${moon.id}/resources`)
        .set(auth(u))
        .expect(200);
      const after = await database.planet.findUniqueOrThrow({ where: { id: moon.id } });
      expect(after.metal).toBe(0);
      expect(after.crystal).toBe(0);
      expect(JSON.stringify(res.body)).toBeDefined();
    });

    it('propose robotique, chantier et bâtiments lunaires seulement ; la base lunaire est refusée sur une planète', async () => {
      const u = await player();
      const moon = await addMoon(u, { metal: 5_000_000, crystal: 5_000_000, deuterium: 5_000_000 });
      await database.planet.update({
        where: { id: u.planetId },
        data: { metal: 5_000_000, crystal: 5_000_000, deuterium: 5_000_000 },
      });
      const onMoon = await request(app.getHttpServer())
        .get(`/planets/${moon.id}/buildings`).set(auth(u)).expect(200);
      expect(onMoon.body.buildings.map((b: { id: number }) => b.id).sort((a: number, b: number) => a - b)).toEqual([14, 21, 41, 42, 43]);
      const onPlanet = await request(app.getHttpServer())
        .get(`/planets/${u.planetId}/buildings`).set(auth(u)).expect(200);
      expect(onPlanet.body.buildings.map((b: { id: number }) => b.id)).not.toContain(41);

      const mine = await request(app.getHttpServer())
        .post(`/planets/${moon.id}/build`).set(auth(u)).send({ buildingId: 1 }).expect(400);
      expect(mine.body.message).toMatch(/lune/);
      const base = await request(app.getHttpServer())
        .post(`/planets/${u.planetId}/build`).set(auth(u)).send({ buildingId: 41 }).expect(400);
      expect(base.body.message).toMatch(/lune/);
    });

    it('un niveau de base lunaire ajoute 3 cases et en occupe une', async () => {
      const u = await player();
      const moon = await addMoon(u, { metal: 5_000_000, crystal: 5_000_000, deuterium: 5_000_000 });
      await request(app.getHttpServer())
        .post(`/planets/${moon.id}/build`).set(auth(u)).send({ buildingId: 41 }).expect(201);
      const entry = await database.buildQueue.findFirstOrThrow({ where: { planetId: moon.id } });
      await buildings.completeConstruction({
        id: entry.id, planetId: moon.id, buildingId: 41, level: entry.level,
      });
      const after = await database.planet.findUniqueOrThrow({ where: { id: moon.id } });
      expect(after.moonBase).toBe(1);
      expect(after.fieldsMax).toBe(4);
      expect(after.fieldsUsed).toBe(1);
    });
  });

  describe('flottes depuis et vers la lune', () => {
    it('transport vers la lune : la cargaison est créditée à la lune, pas à la planète', async () => {
      const u = await player();
      const moon = await addMoon(u);
      await database.ship.create({ data: { planetId: u.planetId, shipId: 202, amount: 5 } });
      await database.planet.update({
        where: { id: u.planetId },
        data: { metal: 100000, crystal: 100000, deuterium: 100000 },
      });
      const before = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
      const res = await send(u, {
        planetId: u.planetId, ...{ toGalaxy: u.planet.galaxy, toSystem: u.planet.system, toPosition: u.planet.position },
        toMoon: true, mission: 3, ships: { '202': 2 }, cargo: { metal: 1000, crystal: 500, deuterium: 0 },
      }).expect(201);
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet).toMatchObject({ toMoon: true, fromMoon: false });
      await makeDue(fleet.id);
      await fleetCron.processArrivals();
      const after = await database.planet.findUniqueOrThrow({ where: { id: moon.id } });
      expect(after.metal).toBe(1000);
      expect(after.crystal).toBe(500);
      const planetAfter = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
      expect(planetAfter.metal).toBeLessThanOrEqual(before.metal - 1000);
    });

    it('déploiement sur la lune puis départ de la lune : le retour se fait sur la lune', async () => {
      const u = await player();
      const moon = await addMoon(u, { metal: 0, crystal: 0, deuterium: 100000 });
      await database.ship.create({ data: { planetId: u.planetId, shipId: 202, amount: 4 } });
      await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 100000 } });
      const deploy = await send(u, {
        planetId: u.planetId, toGalaxy: u.planet.galaxy, toSystem: u.planet.system, toPosition: u.planet.position,
        toMoon: true, mission: 4, ships: { '202': 4 },
      }).expect(201);
      await makeDue(deploy.body.fleetId);
      await fleetCron.processArrivals();
      expect(await shipsOn(moon.id)).toBe(4);
      expect(await shipsOn(u.planetId)).toBe(0);

      // Départ de la lune vers une autre planète de l'univers : la flotte rentre sur la lune
      const other = await player();
      const out = await send(u, {
        planetId: moon.id, toGalaxy: other.planet.galaxy, toSystem: other.planet.system, toPosition: other.planet.position,
        mission: 3, ships: { '202': 2 },
      }).expect(201);
      const outFleet = await database.fleet.findUniqueOrThrow({ where: { id: out.body.fleetId } });
      expect(outFleet.fromMoon).toBe(true);
      expect(await shipsOn(moon.id)).toBe(2);
      await makeDue(outFleet.id);
      await fleetCron.processArrivals();
      await fleetCron.processReturns();
      expect(await shipsOn(moon.id)).toBe(4);
      expect(await shipsOn(u.planetId)).toBe(0);
    });

    it('refuse une lune inexistante, la colonisation d\'une lune et la planète d\'origine comme destination', async () => {
      const u = await player();
      await database.ship.create({ data: { planetId: u.planetId, shipId: 202, amount: 4 } });
      await database.ship.create({ data: { planetId: u.planetId, shipId: 208, amount: 1 } });
      await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 100000 } });
      const same = { toGalaxy: u.planet.galaxy, toSystem: u.planet.system, toPosition: u.planet.position };
      const noMoonSelf = await send(u, { planetId: u.planetId, ...same, mission: 4, ships: { '202': 1 } }).expect(400);
      expect(noMoonSelf.body.message).toMatch(/origine/);

      const victim = await player();
      const ghost = await send(u, {
        planetId: u.planetId,
        toGalaxy: victim.planet.galaxy, toSystem: victim.planet.system, toPosition: victim.planet.position,
        toMoon: true, mission: 1, ships: { '202': 1 },
      }).expect(400);
      expect(ghost.body.message).toMatch(/lune/i);

      const colonize = await send(u, {
        planetId: u.planetId, toGalaxy: 1, toSystem: 1, toPosition: 1, toMoon: true, mission: 7, ships: { '208': 1 },
      }).expect(400);
      expect(colonize.body.message).toMatch(/lune/i);
    });

    it('attaque d\'une lune : le combat porte sur la lune, la planète n\'est pas touchée', async () => {
      const roll = jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(true);
      const attacker = await player();
      const defender = await player();
      const moon = await addMoon(defender, { metal: 4000, crystal: 2000, deuterium: 0 });
      await database.defense.create({ data: { planetId: moon.id, defenseId: 401, amount: 2 } });
      await database.defense.create({ data: { planetId: defender.planetId, defenseId: 401, amount: 7 } });
      await database.ship.create({ data: { planetId: attacker.planetId, shipId: 206, amount: 20 } });
      // Positions de départ aléatoires : de quoi payer un vol entre galaxies éloignées
      await database.planet.update({ where: { id: attacker.planetId }, data: { deuterium: 500_000_000 } });
      const planetBefore = await database.planet.findUniqueOrThrow({ where: { id: defender.planetId } });

      const res = await send(attacker, {
        planetId: attacker.planetId,
        toGalaxy: defender.planet.galaxy, toSystem: defender.planet.system, toPosition: defender.planet.position,
        toMoon: true, mission: 1, ships: { '206': 20 },
      }).expect(201);
      await makeDue(res.body.fleetId);
      await fleetCron.processArrivals();

      expect(await database.defense.findFirst({ where: { planetId: defender.planetId, defenseId: 401 } }))
        .toMatchObject({ amount: 7 });
      const planetAfter = await database.planet.findUniqueOrThrow({ where: { id: defender.planetId } });
      expect(planetAfter.metal).toBeGreaterThanOrEqual(Math.floor(planetBefore.metal));
      const report = await database.combatReport.findFirstOrThrow({ where: { attackerId: attacker.userId } });
      expect(report.defenderDefs).toMatchObject({ '401': 2 });
      // On ne crée pas de lune sur une lune
      expect(roll).not.toHaveBeenCalled();
      expect(report.moonCreated).toBe(false);
      await cleanDebris(defender);
    });

    it('espionnage d\'une lune : le rapport décrit la lune', async () => {
      const spy = await player();
      const target = await player();
      const moon = await addMoon(target, { metal: 1234, crystal: 0, deuterium: 0 });
      await database.ship.create({ data: { planetId: spy.planetId, shipId: 210, amount: 3 } });
      await database.planet.update({ where: { id: spy.planetId }, data: { deuterium: 100000 } });
      const res = await send(spy, {
        planetId: spy.planetId,
        toGalaxy: target.planet.galaxy, toSystem: target.planet.system, toPosition: target.planet.position,
        toMoon: true, mission: 6, ships: { '210': 3 },
      }).expect(201);
      await makeDue(res.body.fleetId);
      await fleetCron.processArrivals();
      const reports = await database.spyReport.findMany({ where: { attackerId: spy.userId } });
      expect(reports).toHaveLength(1);
      expect(JSON.stringify(reports[0])).toContain('1234');
      expect(moon.id).toBeDefined();
    });
  });
});
