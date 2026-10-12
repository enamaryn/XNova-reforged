import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Réseau de recherche intergalactique (123) : le laboratoire effectif d'une recherche est celui de la planète
 * plus les `niveau du réseau` meilleurs laboratoires des autres planètes (lunes exclues) ; le temps annoncé
 * et le temps réel de la recherche suivent ce laboratoire effectif.
 */
describe('API integration - réseau de recherche intergalactique', () => {
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
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const p = me.body.planets[0];
    return { token: accessToken as string, userId: me.body.id as string, planetId: p.id as string, planet: p };
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const colony = (u: Player, system: number, researchLab: number, extra: object = {}) =>
    database.planet.create({
      data: {
        userId: u.userId, name: 'Colonie', galaxy: 5, system, position: 3, fieldsMax: 163, researchLab, ...extra,
      },
    });
  const listing = async (u: Player, planetId = u.planetId) =>
    (await request(app.getHttpServer()).get('/technologies').query({ planetId }).set(auth(u)).expect(200)).body;
  const timeOf = (body: any, techId: number) => body.technologies.find((t: any) => t.id === techId).buildTime;
  const setNetwork = (u: Player, level: number) =>
    database.technology.upsert({
      where: { userId_techId: { userId: u.userId, techId: 123 } },
      update: { level },
      create: { userId: u.userId, techId: 123, level },
    });

  it('la technologie est proposée et sans réseau le laboratoire effectif est le laboratoire local', async () => {
    const u = await player();
    await database.planet.update({ where: { id: u.planetId }, data: { researchLab: 4 } });
    await colony(u, 120, 9);
    const body = await listing(u);
    expect(body.technologies.map((t: { id: number }) => t.id)).toContain(123);
    expect(body.labNetwork).toEqual({ networkLevel: 0, ownLab: 4, effectiveLab: 4, linked: 0 });
  });

  it('niveau 2 : local + deux meilleurs laboratoires des autres planètes, lune exclue', async () => {
    const u = await player();
    await database.planet.update({ where: { id: u.planetId }, data: { researchLab: 4 } });
    await colony(u, 121, 3);
    await colony(u, 122, 8);
    await colony(u, 123, 5);
    // Une lune ne compte jamais, même avec un laboratoire forcé en base
    await database.planet.create({
      data: {
        userId: u.userId, name: 'Lune', galaxy: u.planet.galaxy, system: u.planet.system, position: u.planet.position,
        isMoon: true, planetType: 'moon', fieldsMax: 5, researchLab: 20,
      },
    });
    await setNetwork(u, 2);
    const body = await listing(u);
    expect(body.labNetwork).toEqual({ networkLevel: 2, ownLab: 4, effectiveLab: 17, linked: 2 });
  });

  it('le temps annoncé baisse avec le réseau et correspond au temps réel de la recherche lancée', async () => {
    const u = await player();
    await database.planet.update({
      where: { id: u.planetId },
      data: { researchLab: 3, metal: 5_000_000, crystal: 5_000_000, deuterium: 5_000_000 },
    });
    await colony(u, 124, 9);
    const before = timeOf(await listing(u), 106); // sans réseau : laboratoire 3
    await setNetwork(u, 1); // 3 + 9 = 12
    const after = timeOf(await listing(u), 106);
    expect(after).toBeLessThan(before);

    const started = await request(app.getHttpServer())
      .post('/research').set(auth(u)).send({ planetId: u.planetId, techId: 106 }).expect(201);
    const seconds = Math.round((new Date(started.body.endTime).getTime() - new Date(started.body.startTime).getTime()) / 1000);
    expect(seconds).toBe(after);
  });

  it('un laboratoire plus fort sur une autre planète ne change pas la recherche lancée sans réseau', async () => {
    const u = await player();
    await database.planet.update({ where: { id: u.planetId }, data: { researchLab: 3 } });
    await colony(u, 125, 15);
    const body = await listing(u);
    expect(body.labNetwork.effectiveLab).toBe(3);
    // Lancer depuis la colonie : son laboratoire de 15 s'applique seul
    const other = await database.planet.findFirstOrThrow({ where: { userId: u.userId, name: 'Colonie' } });
    const fromColony = await listing(u, other.id);
    expect(fromColony.labNetwork).toMatchObject({ ownLab: 15, effectiveLab: 15, linked: 0 });
    expect(timeOf(fromColony, 106)).toBeLessThan(timeOf(body, 106));
  });
});
