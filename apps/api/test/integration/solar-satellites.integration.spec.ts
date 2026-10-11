import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { ShipyardService } from '../../src/shipyard/shipyard.service';
import { ServerConfigService } from '../../src/server-config/server-config.service';
import { settleBeforeSatelliteChange } from '../../src/common/satellites';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Satellites solaires : une fois livrés, ils sont en orbite de leur planète et fournissent de l'énergie en
 * permanence (50 chacun) ; ils ne peuvent jamais être envoyés ; leur arrivée ou leur perte n'est pas rétroactive.
 */
describe('API integration - satellites solaires', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let shipyard: ShipyardService;
  let serverConfig: ServerConfigService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    shipyard = app.get(ShipyardService);
    serverConfig = app.get(ServerConfigService);
  });

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  const newPlayer = async () => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return { token: accessToken as string, planetId: me.body.planets[0].id as string };
  };

  const resources = async (token: string, planetId: string) => {
    const res = await request(app.getHttpServer())
      .get(`/planets/${planetId}/resources`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body;
  };

  const deliver = async (token: string, planetId: string, amount: number) => {
    const build = await request(app.getHttpServer())
      .post('/shipyard/build')
      .set('Authorization', `Bearer ${token}`)
      .send({ planetId, shipId: 212, amount })
      .expect(201);
    await database.shipQueue.update({
      where: { id: build.body.queueId },
      data: { startTime: new Date(Date.now() - 5000), endTime: new Date(Date.now() - 1000) },
    });
    const entry = await database.shipQueue.findUniqueOrThrow({ where: { id: build.body.queueId } });
    await shipyard.completeBuild(entry);
  };

  it('fournit 50 d\'énergie par satellite livré, sans effet rétroactif sur le temps écoulé', async () => {
    const { token, planetId } = await newPlayer();
    const hourAgo = new Date(Date.now() - 3600 * 1000);
    // Une mine de métal sans aucune centrale : production à 0 % tant qu'il n'y a pas d'énergie
    await database.planet.update({
      where: { id: planetId },
      data: { shipyard: 1, metalMine: 5, metal: 1000, crystal: 20000, deuterium: 5000, lastUpdate: hourAgo },
    });

    const before = await resources(token, planetId);
    expect(before.energy.available).toBe(0);
    expect(before.energy.productionLevel).toBe(0);

    await database.planet.update({ where: { id: planetId }, data: { lastUpdate: hourAgo } });
    await deliver(token, planetId, 3);

    const after = await resources(token, planetId);
    expect(after.energy.available).toBe(150);
    expect(after.energy.productionLevel).toBe(100);
    expect(after.energy.used).toBeGreaterThan(0);

    // L'heure écoulée avant la livraison n'a produit que le revenu de base (20 métal/h), pas la mine à 100 %
    const planet = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    expect(planet.metal).toBeGreaterThan(1000 + 19);
    expect(planet.metal).toBeLessThan(1000 + 60);
    expect(planet.energyAvailable).toBe(150);
  });

  it('n\'apparaît pas parmi les vaisseaux disponibles et ne peut pas être envoyé', async () => {
    const { token, planetId } = await newPlayer();
    await database.planet.update({
      where: { id: planetId },
      data: { shipyard: 1, crystal: 20000, deuterium: 5000 },
    });
    await deliver(token, planetId, 2);
    expect(await database.ship.findFirst({ where: { planetId, shipId: 212 } })).toMatchObject({ amount: 2 });

    const available = await request(app.getHttpServer())
      .get(`/fleet/available/${planetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(available.body.ships.map((s: { shipId: number }) => s.shipId)).not.toContain(212);

    const other = await newPlayer();
    const target = await database.planet.findUniqueOrThrow({ where: { id: other.planetId } });
    for (const mission of [3, 4, 1]) {
      const res = await request(app.getHttpServer())
        .post('/fleet/send')
        .set('Authorization', `Bearer ${token}`)
        .send({
          planetId,
          toGalaxy: target.galaxy,
          toSystem: target.system,
          toPosition: target.position,
          mission,
          speedPercent: 100,
          ships: { '212': 1 },
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('satellites solaires');
    }
    // Aucun satellite n'a quitté la planète
    expect(await database.ship.findFirst({ where: { planetId, shipId: 212 } })).toMatchObject({ amount: 2 });
    expect(await database.fleet.count({ where: { userId: (await database.planet.findUniqueOrThrow({ where: { id: planetId } })).userId } })).toBe(0);
  });

  it('la perte de satellites baisse l\'énergie à partir de maintenant, pas rétroactivement', async () => {
    const { token, planetId } = await newPlayer();
    const hourAgo = new Date(Date.now() - 3600 * 1000);
    await database.planet.update({
      where: { id: planetId },
      data: { metalMine: 5, metal: 1000, lastUpdate: hourAgo },
    });
    await database.ship.create({ data: { planetId, shipId: 212, amount: 3 } });

    const config = await serverConfig.getResourceConfig();
    await database.$transaction((tx) => settleBeforeSatelliteChange(tx, planetId, config, -3));
    await database.ship.delete({ where: { planetId_shipId: { planetId, shipId: 212 } } });

    const planet = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    // L'heure passée avec 3 satellites a produit à 100 % (mine niveau 5 ≈ 241 métal/h + revenu de base)
    expect(planet.metal).toBeGreaterThan(1000 + 200);
    expect(planet.energyAvailable).toBe(0);

    const after = await resources(token, planetId);
    expect(after.energy.available).toBe(0);
    expect(after.energy.productionLevel).toBe(0);
  });
});
