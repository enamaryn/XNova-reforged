import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { ExpeditionService } from '../../src/fleet/expedition.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Expéditions : mission 15 vers la position 16 d'un système, réservée à la technologie Expédition et
 * limitée en nombre ; à l'arrivée une issue est tirée (rien, ressources, vaisseaux, retard, avance, pirates,
 * trou noir), un rapport est écrit et la flotte rentre normalement.
 */
describe('API integration - expéditions', () => {
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

  const player = async (techLevel = 1) => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const u = { token: accessToken as string, userId: me.body.id as string, planetId: me.body.planets[0].id as string };
    if (techLevel > 0) {
      await database.technology.create({ data: { userId: u.userId, techId: 124, level: techLevel } });
    }
    await database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 108 } },
      update: { level: 6 },
      create: { userId: u.userId, techId: 108, level: 6 },
    });
    await database.ship.create({ data: { planetId: u.planetId, shipId: 203, amount: 10 } });
    await database.ship.create({ data: { planetId: u.planetId, shipId: 202, amount: 20 } });
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 1_000_000 } });
    return u;
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const send = (u: Player, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set(auth(u))
      .send({
        planetId: u.planetId, toGalaxy: 1, toSystem: 77, toPosition: 16, mission: 15,
        speedPercent: 100, ships: { '203': 10 }, cargo: {}, ...body,
      });
  const makeDue = (fleetId: string) =>
    database.fleet.update({
      where: { id: fleetId },
      data: { startTime: new Date(Date.now() - 360_000), arrivalTime: new Date(Date.now() - 60_000), returnTime: new Date(Date.now() + 240_000) },
    });
  /** Force les tirages successifs d'une expédition. */
  const forceRolls = (...rolls: number[]) => {
    const spy = jest.spyOn(ExpeditionService.prototype as any, 'random');
    for (const r of rolls) spy.mockReturnValueOnce(r);
    spy.mockReturnValue(0.5);
    return spy;
  };
  const run = async (u: Player, rolls: number[], body: Record<string, unknown> = {}) => {
    const res = await send(u, body).expect(201);
    const fleetId = res.body.fleetId as string;
    await makeDue(fleetId);
    forceRolls(...rolls);
    await fleetCron.processArrivals();
    const fleet = await database.fleet.findUniqueOrThrow({ where: { id: fleetId } });
    const report = await database.expeditionReport.findFirstOrThrow({
      where: { userId: u.userId }, orderBy: { createdAt: 'desc' },
    });
    return { fleet, report, fleetId };
  };

  describe('envoi', () => {
    it('refuse sans technologie, hors position 16, et la position 16 pour les autres missions', async () => {
      const noTech = await player(0);
      const refused = await send(noTech).expect(400);
      expect(refused.body.message).toMatch(/Expedition/);

      const u = await player(1);
      await send(u, { toPosition: 15 }).expect(400);
      await send(u, { toPosition: 17 }).expect(400);
      await send(u, { toMoon: true }).expect(400);
      await send(u, { mission: 3, toPosition: 16 }).expect(400);
      expect(await database.fleet.count({ where: { userId: u.userId } })).toBe(0);
      expect((await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: u.planetId, shipId: 203 } } })).amount).toBe(10);
    });

    it('débite vaisseaux et carburant, crée la flotte vers la position 16', async () => {
      const u = await player(1);
      const before = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
      const res = await send(u, { cargo: { metal: 100 } }).expect(201);
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet).toMatchObject({ mission: 15, toPosition: 16, toSystem: 77, status: 'traveling', ships: { '203': 10 } });
      const after = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
      expect(after.deuterium).toBeLessThan(before.deuterium);
      expect(after.metal).toBe(before.metal - 100);
    });

    it('limite les expéditions simultanées à la racine du niveau', async () => {
      const u = await player(1);
      await send(u).expect(201);
      const second = await send(u, { ships: { '202': 5 } }).expect(400);
      expect(second.body.message).toMatch(/maximal d'expeditions/);

      const v = await player(4); // deux expéditions
      await send(v).expect(201);
      await send(v, { ships: { '202': 5 } }).expect(201);
      await send(v, { ships: { '202': 2 } }).expect(400);
    });
  });

  describe('issues', () => {
    it('rien : la flotte rentre intacte et un rapport l\'indique', async () => {
      const u = await player();
      const { fleet, report } = await run(u, [0.1]);
      expect(report.outcome).toBe('nothing');
      expect(fleet).toMatchObject({ status: 'returning', ships: { '203': 10 } });
      await database.fleet.update({ where: { id: fleet.id }, data: { returnTime: new Date(Date.now() - 1000) } });
      await fleetCron.processReturns();
      expect((await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: u.planetId, shipId: 203 } } })).amount).toBe(10);
    });

    it('ressources : la cargaison de retour grandit de la part trouvée', async () => {
      const u = await player(1);
      // issue ressources, part à 0,5, métal
      const { fleet, report } = await run(u, [0.4, 0.5, 0.1]);
      expect(report.outcome).toBe('resources');
      // 10 grands transporteurs : 250 000 de capacité ; part 0,1 + 0,1 + 0,02 = 0,22
      expect((fleet.cargo as any).metal).toBe(55000);
      expect(report.details).toMatchObject({ resource: 'metal', amount: 55000 });
      expect(fleet.status).toBe('returning');
    });

    it('vaisseaux trouvés : ajoutés à la flotte qui rentre', async () => {
      const u = await player();
      const { fleet, report } = await run(u, [0.65, 1, 0]); // 10 % de 10 = 1 petit transporteur
      expect(report.outcome).toBe('ships');
      expect(fleet.ships).toEqual({ '203': 10, '202': 1 });
    });

    it('retard et avance : le retour est repoussé ou avancé', async () => {
      const u = await player(1);
      const delayed = await run(u, [0.7, 1]); // facteur 3
      expect(delayed.report.outcome).toBe('delay');
      const flight = 300_000;
      expect(delayed.fleet.returnTime!.getTime() - delayed.fleet.arrivalTime.getTime()).toBe(flight * 3);
      await database.fleet.update({ where: { id: delayed.fleetId }, data: { status: 'completed' } });

      const sped = await run(u, [0.8, 1], { ships: { '202': 5 } }); // facteur 0,5
      expect(sped.report.outcome).toBe('speedup');
      expect(sped.fleet.returnTime!.getTime() - sped.fleet.arrivalTime.getTime()).toBe(flight * 0.5);
    });

    it('pirates : une part de chaque type de vaisseau est perdue', async () => {
      const u = await player();
      const { fleet, report } = await run(u, [0.9, 1], { ships: { '203': 10, '202': 20 } }); // 30 %
      expect(report.outcome).toBe('pirates');
      expect(fleet.ships).toEqual({ '203': 7, '202': 14 });
      expect(report.details).toMatchObject({ lost: { '203': 3, '202': 6 } });
      expect(fleet.status).toBe('returning');
    });

    it('trou noir : flotte et cargaison perdues, rien ne revient', async () => {
      const u = await player();
      const { fleet, report } = await run(u, [0.995], { cargo: { metal: 10 } });
      expect(report.outcome).toBe('blackhole');
      expect(fleet).toMatchObject({ status: 'completed', ships: {}, cargo: {} });
      await fleetCron.processReturns();
      // Les 10 grands transporteurs partis ne reviennent pas
      expect((await database.ship.findUnique({ where: { planetId_shipId: { planetId: u.planetId, shipId: 203 } } }))?.amount ?? 0).toBe(0);
    });

    it('une seule résolution par flotte', async () => {
      const u = await player();
      const { fleetId } = await run(u, [0.1]);
      await database.fleet.update({ where: { id: fleetId }, data: { status: 'traveling' } });
      forceRolls(0.1);
      await Promise.all([fleetCron.processArrivals(), fleetCron.processArrivals()]);
      expect(await database.expeditionReport.count({ where: { userId: u.userId } })).toBe(2);
    });
  });

  describe('rapports', () => {
    it('chacun ne lit que les siens', async () => {
      const a = await player();
      const b = await player();
      const { report } = await run(a, [0.1]);
      const list = await request(app.getHttpServer()).get('/expedition-reports').set(auth(a)).expect(200);
      expect(list.body.map((r: { id: string }) => r.id)).toContain(report.id);
      await request(app.getHttpServer()).get(`/expedition-reports/${report.id}`).set(auth(a)).expect(200);
      await request(app.getHttpServer()).get(`/expedition-reports/${report.id}`).set(auth(b)).expect(404);
      const other = await request(app.getHttpServer()).get('/expedition-reports').set(auth(b)).expect(200);
      expect(other.body).toEqual([]);
    });
  });
});
