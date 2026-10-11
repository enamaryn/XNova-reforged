import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { calculateShipyardBatchSeconds } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { ServerConfigService } from '../../src/server-config/server-config.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * La durée annoncée par la liste (unitTime × quantité) est exactement la durée programmée dans la file,
 * pour les vaisseaux et les défenses, quelle que soit la quantité (régression : 16 min annoncées pour ~20 s).
 */
describe('API integration - durée de fabrication au chantier spatial', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const usernames: string[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const setup = async (shipyard: number, nanites: number) => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set(bearer(accessToken)).expect(200);
    const planetId = me.body.planets[0].id as string;
    await database.planet.update({
      where: { id: planetId },
      data: { metal: 5e9, crystal: 5e9, deuterium: 5e9, shipyard, naniteFactory: nanites, fieldsMax: 500 },
    });
    // Prérequis : combustion 2 (vaisseaux), énergie 2 et laser 3 (artillerie laser légère)
    for (const [techId, level] of [[115, 2], [113, 2], [120, 3]]) {
      await database.technology.upsert({
        where: { userId_techId: { userId: me.body.id, techId } },
        update: { level },
        create: { userId: me.body.id, techId, level },
      });
    }
    return { token: accessToken as string, planetId };
  };

  const durationOf = async (queueId: string) => {
    const row = await database.shipQueue.findUniqueOrThrow({ where: { id: queueId } });
    return Math.round((row.endTime.getTime() - row.startTime.getTime()) / 1000);
  };

  it.each([
    [1, 0],
    [8, 3],
    [20, 10],
  ])('vaisseaux (hangar %i, nanites %i) : durée annoncée = durée de la file pour 1, 10 et 1000 unités', async (shipyard, nanites) => {
    const { token, planetId } = await setup(shipyard, nanites);
    const gameSpeed = (await app.get(ServerConfigService).getConfig()).gameSpeed;
    const list = await request(app.getHttpServer()).get('/shipyard').query({ planetId }).set(bearer(token)).expect(200);
    const fighter = (Array.isArray(list.body) ? list.body : list.body.ships).find((s: { id: number }) => s.id === 204);
    expect(fighter.unitTime).toBeGreaterThan(0);

    for (const amount of [1, 10, 1000]) {
      const announced = Math.max(1, Math.floor(fighter.unitTime * amount));
      const built = await request(app.getHttpServer())
        .post('/shipyard/build')
        .set(bearer(token))
        .send({ planetId, shipId: 204, amount })
        .expect(201);
      expect(await durationOf(built.body.queueId)).toBe(announced);
      expect(announced).toBe(
        calculateShipyardBatchSeconds({ cost: fighter.cost, shipyardLevel: shipyard, naniteLevel: nanites, gameSpeed }, amount),
      );
    }
  });

  it('défenses : même règle, et plancher proportionnel au coût', async () => {
    const { token, planetId } = await setup(20, 10);
    const list = await request(app.getHttpServer()).get('/defense').query({ planetId }).set(bearer(token)).expect(200);
    const defenses = Array.isArray(list.body) ? list.body : list.body.defenses;
    const laser = defenses.find((d: { id: number }) => d.id === 402);
    const launcher = defenses.find((d: { id: number }) => d.id === 401);
    // hangar 20 + nanites 10 : la durée est celle du plancher, donc proportionnelle au coût (métal + cristal)
    const ratio = (laser.cost.metal + laser.cost.crystal) / (launcher.cost.metal + launcher.cost.crystal);
    expect(laser.unitTime / launcher.unitTime).toBeCloseTo(ratio, 5);

    for (const amount of [1, 10, 1000]) {
      const built = await request(app.getHttpServer())
        .post('/defense/build')
        .set(bearer(token))
        .send({ planetId, defenseId: 402, amount });
      expect(built.status).toBe(201);
      expect(await durationOf(built.body.queueId)).toBe(Math.max(1, Math.floor(laser.unitTime * amount)));
    }
  });
});
