import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

/**
 * GAME-02 — le déploiement transfère vaisseaux et cargaison une seule fois, sans retour.
 */
describe('API integration - Déploiement effectif (GAME-02)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;
  const usernames: string[] = [];

  let token: string;
  let userId: string;
  let originId: string;
  let destination: { id: string; galaxy: number; system: number; position: number };

  const past = (seconds: number) => new Date(Date.now() - seconds * 1000);
  const shipsOn = async (planetId: string) =>
    (
      await database.ship.findUnique({
        where: { planetId_shipId: { planetId, shipId: 202 } },
      })
    )?.amount ?? 0;

  const sendDeploy = (ships = 4, cargo = { metal: 1000, crystal: 500, deuterium: 0 }) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planetId: originId,
        toGalaxy: destination.galaxy,
        toSystem: destination.system,
        toPosition: destination.position,
        mission: 4,
        speedPercent: 100,
        ships: { '202': ships },
        cargo,
      });

  /** Force l'arrivée (et le retour éventuel) dans le passé pour que le cron traite la flotte. */
  const makeDue = (fleetId: string) =>
    database.fleet.update({
      where: { id: fleetId },
      data: { arrivalTime: past(60), returnTime: past(10) },
    });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);

    const user = buildTestUser();
    usernames.push(user.username);
    token = (await registerAndLogin(app, user)).accessToken;
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    userId = me.body.id;
    originId = me.body.planets[0].id;
    const origin = me.body.planets[0];

    destination = await database.planet.create({
      data: {
        userId,
        name: 'Destination',
        galaxy: origin.galaxy,
        system: ((origin.system + 3) % 499) + 1,
        position: 14,
      },
    });
  });

  beforeEach(async () => {
    await database.fleet.deleteMany({ where: { userId } });
    await database.ship.deleteMany({ where: { planetId: { in: [originId, destination.id] } } });
    await database.planet.update({
      where: { id: originId },
      data: { metal: 100000, crystal: 100000, deuterium: 100000, lastUpdate: new Date() },
    });
    await database.planet.update({
      where: { id: destination.id },
      data: { metal: 0, crystal: 0, deuterium: 0, lastUpdate: new Date() },
    });
    await database.ship.create({ data: { planetId: originId, shipId: 202, amount: 10 } });
  });

  afterAll(async () => {
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  it('transfère vaisseaux et cargaison à l\'arrivée, sans retour, une seule fois', async () => {
    const res = await sendDeploy().expect(201);
    const fleetId = res.body.fleetId as string;
    expect(await shipsOn(originId)).toBe(6);

    await makeDue(fleetId);
    // Deux workers en parallèle, puis le cron de retour : aucun doublon, aucun retour
    await Promise.all([fleetCron.processArrivals(), fleetCron.processArrivals()]);
    await fleetCron.processReturns();
    await fleetCron.processReturns();

    const fleet = await database.fleet.findUniqueOrThrow({ where: { id: fleetId } });
    const dest = await database.planet.findUniqueOrThrow({ where: { id: destination.id } });
    expect(fleet.status).toBe('completed');
    expect(fleet.ships).toEqual({});
    expect(fleet.cargo).toEqual({});
    expect(await shipsOn(destination.id)).toBe(4);
    expect(await shipsOn(originId)).toBe(6); // rien n'est revenu à l'origine
    expect(dest.metal).toBe(1000);
    expect(dest.crystal).toBe(500);

    // Bilan conservé : 10 vaisseaux au total
    expect((await shipsOn(originId)) + (await shipsOn(destination.id))).toBe(10);
  });

  it('une flotte déployée n\'apparaît plus dans les flottes actives', async () => {
    const res = await sendDeploy().expect(201);
    await makeDue(res.body.fleetId);
    await fleetCron.processArrivals();

    const active = await request(app.getHttpServer())
      .get('/fleet/active')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(active.body.find((f: any) => f.id === res.body.fleetId)).toBeUndefined();
  });

  it('le rappel avant l\'arrivée ramène tout à l\'origine, sans déploiement', async () => {
    const res = await sendDeploy().expect(201);
    const fleetId = res.body.fleetId as string;

    await request(app.getHttpServer())
      .delete(`/fleet/${fleetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await database.fleet.update({ where: { id: fleetId }, data: { returnTime: past(10) } });
    await fleetCron.processArrivals(); // statut 'returning' : ignoré par les arrivées
    await fleetCron.processReturns();

    expect(await shipsOn(originId)).toBe(10);
    expect(await shipsOn(destination.id)).toBe(0);
    const dest = await database.planet.findUniqueOrThrow({ where: { id: destination.id } });
    expect(dest.metal).toBe(0);
  });

  it('si la destination n\'est plus une planète du joueur, la flotte rentre avec son contenu', async () => {
    const res = await sendDeploy().expect(201);
    const fleetId = res.body.fleetId as string;

    // La planète de destination change de propriétaire avant l'arrivée
    const rival = await database.user.create({
      data: {
        username: `g02r_${Math.random().toString(36).slice(2, 10)}`,
        email: `g02r_${Math.random().toString(36).slice(2, 10)}@example.test`,
        password: 'x',
      },
    });
    await database.planet.update({ where: { id: destination.id }, data: { userId: rival.id } });

    await makeDue(fleetId);
    await fleetCron.processArrivals();
    expect((await database.fleet.findUniqueOrThrow({ where: { id: fleetId } })).status).toBe(
      'returning',
    );
    await fleetCron.processReturns();

    expect(await shipsOn(originId)).toBe(10);
    expect(await shipsOn(destination.id)).toBe(0);
    const dest = await database.planet.findUniqueOrThrow({ where: { id: destination.id } });
    expect(dest.metal).toBe(0);

    await database.planet.update({ where: { id: destination.id }, data: { userId } });
    await database.user.delete({ where: { id: rival.id } });
  });

  it('le transport garde son comportement : livraison de la cargaison puis retour des vaisseaux', async () => {
    const res = await request(app.getHttpServer())
      .post('/fleet/send')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planetId: originId,
        toGalaxy: destination.galaxy,
        toSystem: destination.system,
        toPosition: destination.position,
        mission: 3,
        speedPercent: 100,
        ships: { '202': 4 },
        cargo: { metal: 1000, crystal: 0, deuterium: 0 },
      })
      .expect(201);

    await makeDue(res.body.fleetId);
    await fleetCron.processArrivals();
    await fleetCron.processReturns();

    const dest = await database.planet.findUniqueOrThrow({ where: { id: destination.id } });
    expect(dest.metal).toBe(1000);
    expect(await shipsOn(destination.id)).toBe(0);
    expect(await shipsOn(originId)).toBe(10);
  });
});
