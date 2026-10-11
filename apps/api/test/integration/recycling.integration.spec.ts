import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Recycleurs : un combat laisse un champ de débris aux coordonnées de la cible, visible dans la galaxie ;
 * la mission de recyclage le collecte dans la limite de la capacité, une seule fois, et rapporte la récolte.
 */
describe('API integration - champs de débris et recyclage', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;
  const users: ReturnType<typeof buildTestUser>[] = [];
  const fieldsToClean: string[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);
  });

  afterAll(async () => {
    for (const key of fieldsToClean) {
      const [galaxy, system, position] = key.split(':').map(Number);
      await database.debrisField.deleteMany({ where: { galaxy, system, position } });
    }
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
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const past = (s: number) => new Date(Date.now() - s * 1000);
  const field = async (g: number, s: number, p: number, metal: number, crystal: number) => {
    fieldsToClean.push(`${g}:${s}:${p}`);
    await database.debrisField.upsert({
      where: { galaxy_system_position: { galaxy: g, system: s, position: p } },
      update: { metal, crystal },
      create: { galaxy: g, system: s, position: p, metal, crystal },
    });
  };
  const recycle = (u: { userId: string; planet: any }, g: number, s: number, p: number, ships: object) =>
    database.fleet.create({
      data: {
        userId: u.userId,
        fromGalaxy: u.planet.galaxy,
        fromSystem: u.planet.system,
        fromPosition: u.planet.position,
        toGalaxy: g,
        toSystem: s,
        toPosition: p,
        mission: 8,
        ships,
        cargo: {},
        startTime: past(120),
        arrivalTime: past(60),
        returnTime: past(10),
        status: 'traveling',
      } as any,
    });

  it('un combat dépose 30 % des vaisseaux perdus dans le champ de débris, visible dans la galaxie', async () => {
    const attacker = await player();
    const defender = await player();
    // Défenseur : 50 chasseurs légers ; attaquant : un seul petit transporteur détruit
    await database.ship.create({ data: { planetId: defender.planetId, shipId: 204, amount: 50 } });
    await database.ship.create({ data: { planetId: attacker.planetId, shipId: 202, amount: 1 } });
    fieldsToClean.push(`${defender.planet.galaxy}:${defender.planet.system}:${defender.planet.position}`);
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
        ships: { '202': 1 },
        cargo: {},
        startTime: past(120),
        arrivalTime: past(60),
        returnTime: past(10),
        status: 'traveling',
      } as any,
    });

    await fleetCron.processArrivals();

    const debris = await database.debrisField.findFirstOrThrow({
      where: {
        galaxy: defender.planet.galaxy,
        system: defender.planet.system,
        position: defender.planet.position,
      },
    });
    // Petit transporteur : 2000 métal / 2000 cristal → 30 %
    expect(debris.metal).toBe(600);
    expect(debris.crystal).toBe(600);

    const view = await request(app.getHttpServer())
      .get(`/galaxy/${defender.planet.galaxy}/${defender.planet.system}`)
      .set(auth(attacker.token))
      .expect(200);
    const slot = view.body.positions.find((p: any) => p.position === defender.planet.position);
    expect(slot.debris).toEqual({ metal: 600, crystal: 600 });
  });

  it('collecte limitée par la capacité, proportionnelle, une seule fois ; le reste demeure', async () => {
    const u = await player();
    const [g, s, p] = [9, 490, 5];
    await field(g, s, p, 30000, 10000);
    // 1 recycleur = 20 000 de capacité
    const fleet = await recycle(u, g, s, p, { '209': 1 });

    await fleetCron.processArrivals();
    await fleetCron.processArrivals(); // déjà traité : ne collecte pas deux fois

    const after = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    expect(after.status).toBe('returning');
    expect(after.cargo).toEqual({ metal: 15000, crystal: 5000, deuterium: 0 });
    const left = await database.debrisField.findFirstOrThrow({ where: { galaxy: g, system: s, position: p } });
    expect(left.metal).toBe(15000);
    expect(left.crystal).toBe(5000);

    const before = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    await fleetCron.processReturns();
    const planet = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    expect(planet.metal - before.metal).toBeGreaterThanOrEqual(15000);
    expect(planet.crystal - before.crystal).toBeGreaterThanOrEqual(5000);
    const ship = await database.ship.findUniqueOrThrow({
      where: { planetId_shipId: { planetId: u.planetId, shipId: 209 } },
    });
    expect(ship.amount).toBe(1);
  });

  it('deux flottes arrivant ensemble ne se partagent pas plus que le champ', async () => {
    const a = await player();
    const b = await player();
    const [g, s, p] = [9, 491, 6];
    await field(g, s, p, 25000, 0);
    const fa = await recycle(a, g, s, p, { '209': 1 });
    const fb = await recycle(b, g, s, p, { '209': 1 });

    await Promise.all([fleetCron.processArrivals(), fleetCron.processArrivals()]);

    const cargos = await Promise.all(
      [fa, fb].map(async (f) => (await database.fleet.findUniqueOrThrow({ where: { id: f.id } })).cargo as any),
    );
    expect(cargos[0].metal + cargos[1].metal).toBe(25000);
    const left = await database.debrisField.findFirstOrThrow({ where: { galaxy: g, system: s, position: p } });
    expect(left.metal).toBe(0);
  });

  it('envoi : refusé sans débris, refusé avec un autre vaisseau, accepté sinon', async () => {
    const u = await player();
    const [g, s, p] = [9, 492, 7];
    await database.ship.create({ data: { planetId: u.planetId, shipId: 209, amount: 3 } });
    await database.ship.create({ data: { planetId: u.planetId, shipId: 202, amount: 3 } });
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 100000 } });
    await database.technology.create({ data: { userId: u.userId, techId: 108, level: 3 } });
    const send = (ships: object, extra: object = {}) =>
      request(app.getHttpServer())
        .post('/fleet/send')
        .set(auth(u.token))
        .send({
          planetId: u.planetId,
          toGalaxy: g,
          toSystem: s,
          toPosition: p,
          mission: 8,
          speedPercent: 100,
          ships,
          ...extra,
        });

    const none = await send({ '209': 1 }).expect(400);
    expect(none.body.message).toContain('champ de débris');

    await field(g, s, p, 1000, 1000);
    const mixed = await send({ '209': 1, '202': 1 }).expect(400);
    expect(mixed.body.message).toContain('recycleurs');
    const cargo = await send({ '209': 1 }, { cargo: { metal: 1 } }).expect(400);
    expect(cargo.body.message).toContain('aucune cargaison');

    await send({ '209': 1 }).expect(201);
    const row = await database.ship.findUniqueOrThrow({
      where: { planetId_shipId: { planetId: u.planetId, shipId: 209 } },
    });
    expect(row.amount).toBe(2);
  });
});
