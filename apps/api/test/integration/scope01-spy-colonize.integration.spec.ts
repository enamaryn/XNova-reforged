import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { computeSpyInfoLevel } from '../../src/fleet/spy.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

/**
 * SCOPE-01 — missions d'espionnage (6) et de colonisation (7) : validation, résolution à
 * l'arrivée, exécution unique, retour des vaisseaux, contrôle d'accès aux rapports.
 */
describe('API integration - Espionnage et colonisation (SCOPE-01)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let cron: any;

  type Player = {
    token: string;
    userId: string;
    planetId: string;
    galaxy: number;
    system: number;
    position: number;
    username: string;
  };

  const usernames: string[] = [];
  let spy: Player;
  let target: Player;
  let stranger: Player;

  const past = (seconds: number) => new Date(Date.now() - seconds * 1000);
  const server = () => app.getHttpServer();

  const signUp = async (): Promise<Player> => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const planet = me.body.planets[0];
    return {
      token: accessToken,
      userId: me.body.id,
      planetId: planet.id,
      galaxy: planet.galaxy,
      system: planet.system,
      position: planet.position,
      username: user.username,
    };
  };

  const send = (player: Player, body: Record<string, unknown>) =>
    request(server())
      .post('/fleet/send')
      .set('Authorization', `Bearer ${player.token}`)
      .send({ planetId: player.planetId, speedPercent: 100, cargo: {}, ...body });

  const makeDue = (fleetId: string) =>
    database.fleet.update({ where: { id: fleetId }, data: { arrivalTime: past(60), returnTime: past(10) } });

  const setShips = async (planetId: string, ships: Record<number, number>) => {
    await database.ship.deleteMany({ where: { planetId } });
    for (const [shipId, amount] of Object.entries(ships)) {
      await database.ship.create({ data: { planetId, shipId: Number(shipId), amount } });
    }
  };

  const shipsOn = async (planetId: string, shipId: number) =>
    (await database.ship.findUnique({ where: { planetId_shipId: { planetId, shipId } } }))?.amount ?? 0;

  const freePosition = async (galaxy: number, system: number) => {
    for (let position = 1; position <= 15; position += 1) {
      const taken = await database.planet.findUnique({
        where: { galaxy_system_position: { galaxy, system, position } },
      });
      if (!taken) return { galaxy, system, position };
    }
    throw new Error('zone de test saturée');
  };

  const setTech = (userId: string, techId: number, level: number) =>
    database.technology.upsert({
      where: { userId_techId: { userId, techId } },
      update: { level },
      create: { userId, techId, level },
    });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    cron = app.get(FleetCronService);
    spy = await signUp();
    target = await signUp();
    stranger = await signUp();
    // Cible dans le même système que l'espion : carburant négligeable
    const near = await freePosition(spy.galaxy, spy.system);
    await database.planet.update({ where: { id: target.planetId }, data: near });
    Object.assign(target, near);
    for (const p of [spy, target, stranger]) {
      await database.planet.update({
        where: { id: p.planetId },
        data: { metal: 5000, crystal: 3000, deuterium: 100000, lastUpdate: new Date() },
      });
    }
  });

  beforeEach(async () => {
    await database.fleet.deleteMany({ where: { userId: spy.userId } });
    await database.spyReport.deleteMany({ where: { attackerId: spy.userId } });
    await setShips(spy.planetId, { 210: 10, 208: 3, 202: 4 });
    await setShips(target.planetId, {});
    await database.technology.deleteMany({ where: { userId: { in: [spy.userId, target.userId] } } });
  });

  afterAll(async () => {
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  describe('niveau d\'information (fonction pure)', () => {
    it.each([
      [0, 0, 1, 0],
      [1, 0, 1, 1],
      [3, 0, 1, 2],
      [5, 0, 1, 3],
      [0, 0, 4, 2], // 4 sondes : score 3
      [0, 3, 1, 0], // défenseur plus avancé
      [2, 5, 2, 0],
    ])('attaquant %p, défenseur %p, %p sonde(s) → niveau %p', (atk, def, probes, expected) => {
      expect(computeSpyInfoLevel(atk, def, probes)).toBe(expected);
    });
  });

  describe('espionnage : validation (aucun débit en cas de refus)', () => {
    const base = () => ({
      toGalaxy: target.galaxy,
      toSystem: target.system,
      toPosition: target.position,
      mission: 6,
      ships: { '210': 2 },
    });

    const refused = async (body: Record<string, unknown>, message: RegExp) => {
      const before = await shipsOn(spy.planetId, 210);
      const res = await send(spy, body);
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toMatch(message);
      expect(await shipsOn(spy.planetId, 210)).toBe(before);
      expect(await database.fleet.count({ where: { userId: spy.userId } })).toBe(0);
    };

    it('refuse un vaisseau autre qu\'une sonde', () =>
      refused({ ...base(), ships: { '210': 1, '202': 1 } }, /sondes/));
    it('refuse sa propre planète', () =>
      refused({ ...base(), toGalaxy: spy.galaxy, toSystem: spy.system, toPosition: spy.position }, /origine|propre/));
    it('refuse une position sans planète', async () => {
      const free = await freePosition(7, 400);
      await refused({ ...base(), toGalaxy: free.galaxy, toSystem: free.system, toPosition: free.position }, /Aucune planete/);
    });
    it('refuse une cargaison', () =>
      refused({ ...base(), cargo: { metal: 10 } }, /cargaison/));
    it('refuse plus de sondes que disponibles', () =>
      refused({ ...base(), ships: { '210': 11 } }, /insuffisants/));
  });

  describe('espionnage : résolution', () => {
    const sendProbes = async (probes: number) => {
      const res = await send(spy, {
        toGalaxy: target.galaxy,
        toSystem: target.system,
        toPosition: target.position,
        mission: 6,
        ships: { '210': probes },
      }).expect(201);
      await makeDue(res.body.fleetId);
      return res.body.fleetId as string;
    };

    it('niveau 0 : ressources seulement ; deux workers → un seul rapport ; sondes de retour', async () => {
      await setShips(target.planetId, { 202: 5 });
      await database.planet.update({ where: { id: target.planetId }, data: { metal: 4321, crystal: 1234, deuterium: 77 } });
      const fleetId = await sendProbes(1);
      expect(await shipsOn(spy.planetId, 210)).toBe(9);

      await Promise.all([cron.processArrivals(), cron.processArrivals()]);

      const reports = await database.spyReport.findMany({ where: { attackerId: spy.userId } });
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ defenderId: target.userId, probes: 1, infoLevel: 0, planetName: expect.any(String) });
      const data = reports[0].data as any;
      expect(data.resources.metal).toBeGreaterThanOrEqual(4321);
      expect(data.resources.metal).toBeLessThan(4400); // production non enregistrée comprise, bornée
      expect(data.ships).toBeUndefined();
      expect(data.buildings).toBeUndefined();
      expect(data.technologies).toBeUndefined();

      expect((await database.fleet.findUniqueOrThrow({ where: { id: fleetId } })).status).toBe('returning');
      await cron.processReturns();
      expect(await shipsOn(spy.planetId, 210)).toBe(10); // sonde non détruite, créditée une fois
    });

    it('niveau 3 : flotte, bâtiments et technologies révélés', async () => {
      await setTech(spy.userId, 106, 7);
      await setTech(target.userId, 106, 1);
      await setTech(target.userId, 113, 4);
      await setShips(target.planetId, { 202: 5, 204: 2 });
      await database.planet.update({ where: { id: target.planetId }, data: { metalMine: 6 } });

      await sendProbes(1);
      await cron.processArrivals();

      const report = await database.spyReport.findFirstOrThrow({ where: { attackerId: spy.userId } });
      expect(report.infoLevel).toBe(3);
      const data = report.data as any;
      expect(data.ships).toEqual({ '202': 5, '204': 2 });
      expect(data.buildings.metalMine).toBe(6);
      expect(data.technologies['113']).toBe(4);
    });

    it('la cible n\'est pas informée et ne peut pas lire le rapport', async () => {
      await sendProbes(1);
      await cron.processArrivals();
      const report = await database.spyReport.findFirstOrThrow({ where: { attackerId: spy.userId } });

      const own = await request(server()).get('/spy-reports').set('Authorization', `Bearer ${spy.token}`).expect(200);
      expect(own.body.map((r: any) => r.id)).toContain(report.id);

      const defenderList = await request(server()).get('/spy-reports').set('Authorization', `Bearer ${target.token}`).expect(200);
      expect(defenderList.body).toHaveLength(0);

      await request(server()).get(`/spy-reports/${report.id}`).set('Authorization', `Bearer ${spy.token}`).expect(200);
      await request(server()).get(`/spy-reports/${report.id}`).set('Authorization', `Bearer ${target.token}`).expect(403);
      await request(server()).get(`/spy-reports/${report.id}`).set('Authorization', `Bearer ${stranger.token}`).expect(403);
      await request(server()).get('/spy-reports/inexistant').set('Authorization', `Bearer ${spy.token}`).expect(404);
    });

    it('l\'ancien scan gratuit (route sans coût ni contrôle) n\'existe plus', async () => {
      await request(server())
        .get(`/planets/scan/${target.planetId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect((res) => {
          // `scan` est désormais interprété comme un identifiant de planète : refus, jamais de données
          expect([403, 404]).toContain(res.status);
          expect(JSON.stringify(res.body)).not.toContain('"resources"');
        });
    });
  });

  describe('colonisation', () => {
    let spot: { galaxy: number; system: number; position: number };

    beforeEach(async () => {
      spot = await freePosition(7, 410);
      // Ramène le joueur à une seule planète pour maîtriser le quota
      await database.planet.deleteMany({ where: { userId: spy.userId, id: { not: spy.planetId } } });
    });

    const sendColony = (ships: Record<string, number>, extra: Record<string, unknown> = {}, where = spot) =>
      send(spy, {
        toGalaxy: where.galaxy,
        toSystem: where.system,
        toPosition: where.position,
        mission: 7,
        ships,
        planetName: 'Nouvelle Terre',
        ...extra,
      });

    describe('validation (aucun débit en cas de refus)', () => {
      const refused = async (res: request.Test, message: RegExp) => {
        const before = await shipsOn(spy.planetId, 208);
        const r = await res;
        expect(r.status).toBe(400);
        expect(String(r.body.message)).toMatch(message);
        expect(await shipsOn(spy.planetId, 208)).toBe(before);
        expect(await database.fleet.count({ where: { userId: spy.userId } })).toBe(0);
      };

      it('exige un vaisseau de colonisation', () => refused(sendColony({ '202': 1 }), /colonisation/));
      it('refuse une position occupée', () =>
        refused(sendColony({ '208': 1 }, {}, { galaxy: target.galaxy, system: target.system, position: target.position }), /occupee/));
      it('refuse une cargaison', () => refused(sendColony({ '208': 1 }, { cargo: { metal: 5 } }), /cargaison/));
      it('refuse un nom trop long', () => refused(sendColony({ '208': 1 }, { planetName: 'x'.repeat(31) }), /planetName/));
      it('refuse au maximum de planètes', async () => {
        const ids = await database.planet.count({ where: { userId: spy.userId } });
        const fillers = Array.from({ length: 21 - ids }, (_, i) => ({
          userId: spy.userId,
          name: `Rempl${i}`,
          galaxy: 6,
          system: 300 + Math.floor(i / 15),
          position: (i % 15) + 1,
        }));
        await database.planet.createMany({ data: fillers, skipDuplicates: true });
        const count = await database.planet.count({ where: { userId: spy.userId } });
        if (count >= 21) {
          await refused(sendColony({ '208': 1 }), /maximal/);
        }
        await database.planet.deleteMany({ where: { userId: spy.userId, id: { not: spy.planetId } } });
      });
    });

    it('arrivée : planète créée, un colonisateur consommé, le reste de la flotte rentre', async () => {
      const res = await sendColony({ '208': 2, '202': 1 }).expect(201);
      await makeDue(res.body.fleetId);
      expect(await shipsOn(spy.planetId, 208)).toBe(1);

      await cron.processArrivals();

      const colony = await database.planet.findUniqueOrThrow({
        where: { galaxy_system_position: spot },
      });
      expect(colony).toMatchObject({ userId: spy.userId, name: 'Nouvelle Terre', metal: 500, crystal: 500 });

      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(fleet.ships).toEqual({ '208': 1, '202': 1 });

      await cron.processReturns();
      expect(await shipsOn(spy.planetId, 208)).toBe(2); // 3 - 2 envoyés + 1 revenu
      expect(await shipsOn(spy.planetId, 202)).toBe(4);
    });

    it('un seul colonisateur : flotte terminée, rien ne revient', async () => {
      await setShips(spy.planetId, { 208: 1 });
      const res = await sendColony({ '208': 1 }).expect(201);
      await makeDue(res.body.fleetId);

      await Promise.all([cron.processArrivals(), cron.processArrivals()]); // deux workers

      expect(await database.planet.count({ where: { ...spot } })).toBe(1);
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet.status).toBe('completed');
      expect(fleet.ships).toEqual({});
      await cron.processReturns();
      expect(await shipsOn(spy.planetId, 208)).toBe(0);
    });

    it('position prise avant l\'arrivée : la flotte rentre intacte, aucune planète', async () => {
      const res = await sendColony({ '208': 1 }).expect(201);
      await database.planet.create({
        data: { userId: stranger.userId, name: 'Squatteur', ...spot },
      });
      await makeDue(res.body.fleetId);

      await cron.processArrivals();

      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(fleet.ships).toEqual({ '208': 1 });
      expect((await database.planet.findUniqueOrThrow({ where: { galaxy_system_position: spot } })).userId).toBe(stranger.userId);
      await cron.processReturns();
      expect(await shipsOn(spy.planetId, 208)).toBe(3);
      await database.planet.delete({ where: { galaxy_system_position: spot } });
    });

    it('deux flottes vers la même position : une planète, l\'autre flotte rentre intacte', async () => {
      const a = await sendColony({ '208': 1 }).expect(201);
      const b = await sendColony({ '208': 1 }).expect(201);
      await Promise.all([makeDue(a.body.fleetId), makeDue(b.body.fleetId)]);

      await cron.processArrivals();

      expect(await database.planet.count({ where: { ...spot } })).toBe(1);
      const fleets = await database.fleet.findMany({ where: { id: { in: [a.body.fleetId, b.body.fleetId] } } });
      expect(fleets.filter((f) => f.status === 'completed')).toHaveLength(1); // a fondé la colonie
      const returning = fleets.filter((f) => f.status === 'returning');
      expect(returning).toHaveLength(1);
      expect(returning[0].ships).toEqual({ '208': 1 });
    });

    it('quota respecté à l\'arrivée : jamais plus de 21 planètes', async () => {
      const count = await database.planet.count({ where: { userId: spy.userId } });
      const fillers = Array.from({ length: 20 - count }, (_, i) => ({
        userId: spy.userId,
        name: `Q${i}`,
        galaxy: 5,
        system: 200 + Math.floor(i / 15),
        position: (i % 15) + 1,
      }));
      await database.planet.createMany({ data: fillers, skipDuplicates: true });
      const before = await database.planet.count({ where: { userId: spy.userId } });
      const spotB = await freePosition(7, 411);
      const a = await sendColony({ '208': 1 }).expect(201);
      const b = await sendColony({ '208': 1 }, {}, spotB).expect(201);
      await Promise.all([makeDue(a.body.fleetId), makeDue(b.body.fleetId)]);

      await Promise.all([cron.processArrivals(), cron.processArrivals()]);

      const after = await database.planet.count({ where: { userId: spy.userId } });
      expect(after - before).toBe(Math.min(2, 21 - before));
      expect(after).toBeLessThanOrEqual(21);
      await database.planet.deleteMany({ where: { userId: spy.userId, id: { not: spy.planetId } } });
    });

    it('l\'ancienne colonisation instantanée n\'existe plus', async () => {
      await request(server())
        .post('/planets/colonize')
        .set('Authorization', `Bearer ${spy.token}`)
        .send({ originPlanetId: spy.planetId, ...spot, name: 'Instant' })
        .expect(404);
      expect(await database.planet.count({ where: { ...spot } })).toBe(0);
    });
  });
});
