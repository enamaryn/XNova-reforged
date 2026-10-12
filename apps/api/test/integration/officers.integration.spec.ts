import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { OFFICER_COST_DEUTERIUM } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Officiers : embauche définitive payée en deutérium, bonus appliqués aux durées de construction et de
 * recherche, aux files de construction, aux mines (sans effet rétroactif) et à la vitesse des flottes.
 */
describe('API integration - officiers', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: ReturnType<typeof buildTestUser>[] = [];

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
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await database.planet.update({
      where: { id: me.body.planets[0].id },
      // sous la capacité de stockage (1 000 000 × 1,1) : le règlement de production ne rogne rien
      data: { metal: 100_000, crystal: 100_000, deuterium: 1_000_000, researchLab: 5 },
    });
    return { token: accessToken as string, userId: me.body.id as string, planetId: me.body.planets[0].id as string };
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const hire = (u: Player, type: string) =>
    request(app.getHttpServer()).post(`/officers/${type}/hire`).set(auth(u)).send({ planetId: u.planetId });
  const buildTime = async (u: Player, buildingId: number) =>
    (await request(app.getHttpServer()).get(`/planets/${u.planetId}/buildings`).set(auth(u)).expect(200)).body.buildings.find(
      (b: any) => b.id === buildingId,
    ).buildTime;
  const researchTime = async (u: Player, techId: number) =>
    (await request(app.getHttpServer()).get('/technologies').query({ planetId: u.planetId }).set(auth(u)).expect(200)).body.technologies.find(
      (t: any) => t.id === techId,
    ).buildTime;

  it('liste les cinq officiers non embauchés, avec leur prix', async () => {
    const u = await player();
    const res = await request(app.getHttpServer()).get('/officers').set(auth(u)).expect(200);
    expect(res.body.cost).toBe(OFFICER_COST_DEUTERIUM);
    expect(res.body.officers).toHaveLength(5);
    expect(res.body.officers.every((o: any) => !o.hired)).toBe(true);
  });

  it("l'embauche prélève le prix, est définitive et refuse un second achat", async () => {
    const u = await player();
    const before = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    const res = await hire(u, 'engineer').expect(201);
    expect(res.body.officers.find((o: any) => o.type === 'engineer').hired).toBe(true);
    const after = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    expect(after.deuterium).toBeLessThanOrEqual(before.deuterium - OFFICER_COST_DEUTERIUM + 1000);
    expect(after.deuterium).toBeGreaterThan(before.deuterium - OFFICER_COST_DEUTERIUM - 1000);
    await hire(u, 'engineer').expect(409);
    expect(await database.officer.count({ where: { userId: u.userId } })).toBe(1);
  });

  it('refuse un type inconnu, une planète étrangère et un deutérium insuffisant', async () => {
    const u = await player();
    const other = await player();
    await hire(u, 'magicien').expect(404);
    await request(app.getHttpServer())
      .post('/officers/admiral/hire').set(auth(u)).send({ planetId: other.planetId }).expect(404);
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 10 } });
    await hire(u, 'admiral').expect(400);
    expect(await database.officer.count({ where: { userId: u.userId } })).toBe(0);
  });

  it("l'ingénieur réduit la durée de construction de 10 %, le technocrate celle des recherches", async () => {
    const u = await player();
    const building = await buildTime(u, 31);
    const tech = await researchTime(u, 106);
    await hire(u, 'engineer').expect(201);
    await hire(u, 'technocrate').expect(404);
    await hire(u, 'technocrat').expect(201);
    expect(await buildTime(u, 31)).toBe(Math.max(1, Math.floor(building * 0.9)));
    expect(await researchTime(u, 106)).toBe(Math.max(1, Math.floor(tech * 0.9)));
  });

  it("l'intendant ajoute une place de construction", async () => {
    const u = await player();
    const cap = async () =>
      (await request(app.getHttpServer()).get(`/planets/${u.planetId}/buildings`).set(auth(u)).expect(200)).body.buildings[0].buildingCapacity;
    const base = await cap();
    await hire(u, 'intendant').expect(201);
    expect(await cap()).toBe(base + 1);
  });

  it("le géologue augmente la production sans effet rétroactif sur le temps écoulé", async () => {
    const u = await player();
    await database.planet.update({
      where: { id: u.planetId },
      data: { metalMine: 10, solarPlant: 20, lastUpdate: new Date(Date.now() - 3600_000) },
    });
    const before = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    await hire(u, 'geologist').expect(201);
    const after = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    // l'heure écoulée est réglée avec l'ancien rendement : le métal gagné est celui d'une heure sans bonus
    const gained = after.metal - before.metal;
    const rateAfter = after.metalProduction;
    expect(rateAfter).toBeGreaterThan(0);
    expect(gained).toBeLessThan(rateAfter * 0.95);
    expect(gained).toBeGreaterThan(0);
  });

  it("l'amiral accélère les flottes et ajoute deux expéditions simultanées", async () => {
    const u = await player();
    await database.technology.createMany({
      data: [
        { userId: u.userId, techId: 124, level: 1 },
        { userId: u.userId, techId: 108, level: 6 },
      ],
    });
    await database.ship.create({ data: { planetId: u.planetId, shipId: 203, amount: 30 } });
    const send = () =>
      request(app.getHttpServer())
        .post('/fleet/send')
        .set(auth(u))
        .send({
          planetId: u.planetId, toGalaxy: 1, toSystem: 90, toPosition: 16, mission: 15,
          speedPercent: 100, ships: { '203': 5 }, cargo: {},
        });
    const first = await send().expect(201);
    // niveau 1 : une seule expédition à la fois
    await send().expect(400);
    await hire(u, 'admiral').expect(201);
    const second = await send().expect(201);
    expect(second.body.durationSeconds).toBeLessThan(first.body.durationSeconds);
    await send().expect(201);
    await send().expect(400);
  });
});
