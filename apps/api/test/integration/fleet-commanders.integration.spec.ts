import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  FLEET_COMMANDER_COST_DEUTERIUM,
  MAX_FLEET_COMMANDERS,
  experienceToLevel,
} from '@xnova/game-config';
import { CombatService } from '../../src/combat/combat.service';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
  createPlanetAtFreeCoordinates,
} from './helpers';

/**
 * Commandants de flotte : recrutement payé, limite par joueur, points de compétence, assignation à l'envoi
 * (libre/en mission), effets sur la vitesse et la cargaison, expérience au combat et mort d'une flotte détruite.
 */
describe('API integration - commandants de flotte', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  /** Colonie du joueur à des coordonnées aléatoires : cible d'un transport (la cible doit exister). */
  const colony = async (u: { userId: string; planet: { galaxy: number } }) => {
    const planet = await createPlanetAtFreeCoordinates(
      database,
      { userId: u.userId, name: 'Cible', fieldsMax: 163 },
      { galaxy: u.planet.galaxy, system: [300, 489] },
    );
    return { toGalaxy: planet.galaxy, toSystem: planet.system, toPosition: planet.position };
  };
  const targets = new Map<string, { toGalaxy: number; toSystem: number; toPosition: number }>();
  const player = async () => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const planetId = me.body.planets[0].id as string;
    // sous la capacité de stockage de départ : le règlement de production ne rogne rien
    await database.planet.update({ where: { id: planetId }, data: { deuterium: 1_000_000, metal: 100_000, crystal: 100_000 } });
    const u = { token: accessToken as string, userId: me.body.id as string, planetId, planet: me.body.planets[0] };
    targets.set(u.userId, await colony(u));
    return u;
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const recruit = (u: Player, name = 'Aldric') =>
    request(app.getHttpServer()).post('/fleet-commanders').set(auth(u)).send({ name, planetId: u.planetId });
  const list = async (u: Player) => (await request(app.getHttpServer()).get('/fleet-commanders').set(auth(u)).expect(200)).body;
  const withCommander = async (u: Player, data: Record<string, number> = {}) => {
    const c = await database.fleetCommander.create({ data: { userId: u.userId, name: 'Test', ...data } });
    return c.id;
  };
  const past = (s: number) => new Date(Date.now() - s * 1000);
  /** Envoi d'un transport vers la colonie (4 grands transporteurs : 100 000 de capacité). */
  const sendTransport = (u: Player, extra: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set(auth(u))
      .send({
        planetId: u.planetId, ...targets.get(u.userId), mission: 3, speedPercent: 100,
        ships: { '203': 4 }, cargo: {}, ...extra,
      });

  it('liste vide, avec le prix et la limite', async () => {
    const u = await player();
    const body = await list(u);
    expect(body.commanders).toEqual([]);
    expect(body.cost).toBe(FLEET_COMMANDER_COST_DEUTERIUM);
    expect(body.max).toBe(MAX_FLEET_COMMANDERS);
  });

  it('le recrutement prélève le prix ; limite, nom, deutérium et planète étrangère refusés', async () => {
    const u = await player();
    const other = await player();
    const before = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    const res = await recruit(u, '  Aldric  ').expect(201);
    expect(res.body.commanders[0]).toMatchObject({ name: 'Aldric', level: 1, skillPoints: 0, busy: false });
    const after = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    expect(after.deuterium).toBeLessThanOrEqual(before.deuterium - FLEET_COMMANDER_COST_DEUTERIUM + 1000);
    expect(after.deuterium).toBeGreaterThan(before.deuterium - FLEET_COMMANDER_COST_DEUTERIUM - 1000);

    await recruit(u, 'X').expect(400);
    await request(app.getHttpServer()).post('/fleet-commanders').set(auth(u)).send({ name: 'Voleur', planetId: other.planetId }).expect(404);
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 1_000_000 } });
    await recruit(u, 'Brenn').expect(201);
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 1_000_000 } });
    await recruit(u, 'Cael').expect(201);
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 1_000_000 } });
    await recruit(u, 'Dorn').expect(400); // quatrième : limite atteinte
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 10 } });
    await database.fleetCommander.deleteMany({ where: { userId: u.userId, name: 'Cael' } });
    await recruit(u, 'Eloi').expect(400); // deutérium insuffisant
    expect(await database.fleetCommander.count({ where: { userId: u.userId } })).toBe(2);
  });

  it('un point de compétence se dépense atomiquement, jamais au-delà de 10 ni sans point', async () => {
    const u = await player();
    const id = await withCommander(u, { skillPoints: 2, level: 3, experience: 2500 });
    const spend = (skill: string) => request(app.getHttpServer()).post(`/fleet-commanders/${id}/skills/${skill}`).set(auth(u));
    await spend('magie').expect(400);
    const res = await spend('attack').expect(201);
    expect(res.body.commanders[0]).toMatchObject({ skillPoints: 1, skills: { attack: 1 }, bonuses: { attack: 0.01 } });
    await Promise.all([spend('speed'), spend('speed')]);
    const row = await database.fleetCommander.findUniqueOrThrow({ where: { id } });
    // deux points au total : une seule dépense restante possible
    expect(row.skillPoints).toBe(0);
    expect(row.attack + row.speed).toBe(2);
    await spend('cargo').expect(400);
    await database.fleetCommander.update({ where: { id }, data: { skillPoints: 5, defense: 10 } });
    await spend('defense').expect(400);
    const other = await player();
    await request(app.getHttpServer()).post(`/fleet-commanders/${id}/skills/attack`).set(auth(other)).expect(404);
  });

  it("l'assignation à l'envoi : libre seulement, du joueur seulement, libéré à la fin de la flotte", async () => {
    const u = await player();
    const other = await player();
    await database.ship.create({ data: { planetId: u.planetId, shipId: 203, amount: 20 } });
    await database.technology.createMany({ data: [{ userId: u.userId, techId: 108, level: 0 }], skipDuplicates: true });
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 1_000_000 } });
    await database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 125 } }, update: { level: 1 }, create: { userId: u.userId, techId: 125, level: 1 },
    });
    await database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 108 } }, update: { level: 3 }, create: { userId: u.userId, techId: 108, level: 3 },
    });
    const id = await withCommander(u);
    const foreign = await withCommander(other);
    await sendTransport(u, { commanderId: foreign }).expect(404);
    const sent = await sendTransport(u, { commanderId: id }).expect(201);
    expect((await list(u)).commanders[0].busy).toBe(true);
    const second = await sendTransport(u, { commanderId: id });
    expect([400, 404]).toContain(second.status); // déjà en mission (ou plus de place de flotte)
    await request(app.getHttpServer()).delete(`/fleet-commanders/${id}`).set(auth(u)).expect(400);
    await database.fleet.update({ where: { id: sent.body.fleetId }, data: { status: 'completed' } });
    expect((await list(u)).commanders[0].busy).toBe(false);
    await request(app.getHttpServer()).delete(`/fleet-commanders/${id}`).set(auth(u)).expect(200);
    expect(await database.fleetCommander.count({ where: { userId: u.userId } })).toBe(0);
  });

  it('la compétence Vitesse raccourcit le trajet et la compétence Cargaison relève la capacité', async () => {
    const u = await player();
    await database.ship.create({ data: { planetId: u.planetId, shipId: 203, amount: 40 } });
    await database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 125 } }, update: { level: 1 }, create: { userId: u.userId, techId: 125, level: 1 },
    });
    await database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 108 } }, update: { level: 3 }, create: { userId: u.userId, techId: 108, level: 3 },
    });
    await database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 115 } }, update: { level: 1 }, create: { userId: u.userId, techId: 115, level: 1 },
    });
    const fast = await withCommander(u, { speed: 10, cargo: 10 });
    const plain = (await sendTransport(u).expect(201)).body;
    const boosted = (await sendTransport(u, { commanderId: fast }).expect(201)).body;
    expect(boosted.durationSeconds).toBeLessThan(plain.durationSeconds);
    // 4 grands transporteurs = 100 000 ; +10 % de cargaison accepte 105 000 mais pas 111 000
    await database.fleet.updateMany({ where: { userId: u.userId }, data: { status: 'completed' } });
    await database.planet.update({ where: { id: u.planetId }, data: { metal: 900_000, crystal: 900_000 } });
    await sendTransport(u, { cargo: { metal: 105_000 } }).expect(400);
    await database.fleet.updateMany({ where: { userId: u.userId }, data: { status: 'completed' } });
    await sendTransport(u, { commanderId: fast, cargo: { metal: 105_000 } }).expect(201);
    await database.fleet.updateMany({ where: { userId: u.userId }, data: { status: 'completed' } });
    await sendTransport(u, { commanderId: fast, cargo: { metal: 111_000 } }).expect(400);
  });

  describe('combat', () => {
    const battle = async (attackerShips: Record<string, number>, defenderShips: Record<string, number>, commanderId: string, a: Player, d: Player) => {
      for (const [id, n] of Object.entries(defenderShips)) await database.ship.create({ data: { planetId: d.planetId, shipId: Number(id), amount: n } });
      return database.fleet.create({
        data: {
          userId: a.userId,
          fromGalaxy: a.planet.galaxy, fromSystem: a.planet.system, fromPosition: a.planet.position,
          toGalaxy: d.planet.galaxy, toSystem: d.planet.system, toPosition: d.planet.position,
          mission: 1, ships: attackerShips, cargo: {},
          startTime: past(120), arrivalTime: past(60), returnTime: past(10), status: 'traveling',
          commanderId,
        } as any,
      });
    };

    it("le commandant gagne de l'expérience, passe un niveau et reçoit un point de compétence", async () => {
      const a = await player();
      const d = await player();
      const id = await withCommander(a, { experience: experienceToLevel(1) - 50 });
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      await battle({ '206': 300 }, { '204': 400 }, id, a, d);
      await fleetCron.processArrivals();
      const row = await database.fleetCommander.findUniqueOrThrow({ where: { id } });
      expect(row.experience).toBeGreaterThan(experienceToLevel(1));
      expect(row.level).toBeGreaterThanOrEqual(2);
      expect(row.skillPoints).toBe(row.level - 1);
    });

    it('flotte détruite : le commandant meurt si le tirage est défavorable, survit sinon', async () => {
      const a = await player();
      const d = await player();
      const doomed = await withCommander(a);
      const lucky = await withCommander(a);
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const death = jest.spyOn(CombatService.prototype as any, 'rollCommanderDeath');
      death.mockReturnValueOnce(true).mockReturnValueOnce(false);
      await battle({ '202': 1 }, { '207': 20 }, doomed, a, d);
      await database.fleet.create({
        data: {
          userId: a.userId,
          fromGalaxy: a.planet.galaxy, fromSystem: a.planet.system, fromPosition: a.planet.position,
          toGalaxy: d.planet.galaxy, toSystem: d.planet.system, toPosition: d.planet.position,
          mission: 1, ships: { '202': 1 }, cargo: {},
          startTime: past(120), arrivalTime: past(59), returnTime: past(10), status: 'traveling', commanderId: lucky,
        } as any,
      });
      await fleetCron.processArrivals();
      const alive = await database.fleetCommander.findMany({ where: { userId: a.userId }, select: { id: true } });
      expect(death).toHaveBeenCalledTimes(2);
      expect(alive.map((c) => c.id)).toHaveLength(1);
    });

    it('une flotte qui survit ne risque pas son commandant', async () => {
      const a = await player();
      const d = await player();
      const id = await withCommander(a);
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const death = jest.spyOn(CombatService.prototype as any, 'rollCommanderDeath').mockReturnValue(true);
      await battle({ '206': 300 }, { '204': 400 }, id, a, d);
      await fleetCron.processArrivals();
      expect(await database.fleetCommander.count({ where: { id } })).toBe(1);
      expect(death).not.toHaveBeenCalled();
    });
  });
});
