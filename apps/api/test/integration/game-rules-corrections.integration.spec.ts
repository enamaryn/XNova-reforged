import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { updateResources } from '@xnova/game-engine';
import { DatabaseService } from '../../src/database/database.service';
import { BuildingsService } from '../../src/buildings/buildings.service';
import { ResearchService } from '../../src/research/research.service';
import { ServerConfigService } from '../../src/server-config/server-config.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Corrections des écarts de règles : centrale à fusion (deutérium + technologie Énergie), terraformeur (+5 cases),
 * éléments non fonctionnels masqués, flottes en vol limitées par la technologie Ordinateur.
 */
describe('API integration - corrections des règles du jeu', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let buildings: BuildingsService;
  let research: ResearchService;
  let serverConfig: ServerConfigService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    buildings = app.get(BuildingsService);
    research = app.get(ResearchService);
    serverConfig = app.get(ServerConfigService);
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
    return {
      token: accessToken as string,
      userId: me.body.id as string,
      planetId: me.body.planets[0].id as string,
      planet: me.body.planets[0] as { galaxy: number; system: number; position: number },
    };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const setTech = (userId: string, techId: number, level: number) =>
    database.technology.upsert({
      where: { userId_techId: { userId, techId } },
      update: { level },
      create: { userId, techId, level },
    });

  describe('centrale à fusion', () => {
    it('brûle du deutérium et son énergie dépend de la technologie Énergie', async () => {
      const p = await player();
      const hourAgo = new Date(Date.now() - 3600 * 1000);
      await database.planet.update({
        where: { id: p.planetId },
        data: { fusionPlant: 5, deuterium: 1000, lastUpdate: hourAgo },
      });

      const base = await request(app.getHttpServer())
        .get(`/planets/${p.planetId}/resources`)
        .set(auth(p.token))
        .expect(200);
      // Niveau 5, technologie Énergie 0 : 30 × 5 × 1,05^5
      expect(base.body.energy.available).toBe(Math.floor(30 * 5 * Math.pow(1.05, 5)));
      const { gameSpeed, resourceMultiplier } = await serverConfig.getResourceConfig();
      const perHour = 10 * 5 * Math.pow(1.1, 5) * gameSpeed * resourceMultiplier;
      expect(base.body.production.deuterium).toBeCloseTo(-perHour, 3);
      // Une heure de fonctionnement a consommé du deutérium (jamais de stock négatif)
      const planet = await database.planet.findUniqueOrThrow({ where: { id: p.planetId } });
      expect(planet.deuterium).toBeCloseTo(Math.max(0, 1000 - perHour), 0);

      await setTech(p.userId, 113, 3);
      const boosted = await request(app.getHttpServer())
        .get(`/planets/${p.planetId}/resources`)
        .set(auth(p.token))
        .expect(200);
      // Technologie Énergie 3 : 30 × 5 × (1,05 + 0,03)^5
      expect(boosted.body.energy.available).toBe(Math.floor(30 * 5 * Math.pow(1.08, 5)));
      expect(boosted.body.energy.available).toBeGreaterThan(base.body.energy.available);
    });

    it('le niveau de technologie Énergie atteint ne s\'applique pas rétroactivement', async () => {
      const p = await player();
      const hourAgo = new Date(Date.now() - 3600 * 1000);
      // Mine de métal 10 (consomme 260) alimentée par une fusion 5 : production partielle
      await database.planet.update({
        where: { id: p.planetId },
        data: { metalMine: 10, fusionPlant: 5, deuterium: 100000, metal: 1000, lastUpdate: hourAgo },
      });
      const config = await serverConfig.getResourceConfig();
      const planet = await database.planet.findUniqueOrThrow({ where: { id: p.planetId } });
      const expectedOld = updateResources({
        resources: planet,
        levels: { ...planet, energyTechnology: 0 },
        lastUpdate: hourAgo,
        now: new Date(),
        config,
      }).resources.metal;
      const expectedNew = updateResources({
        resources: planet,
        levels: { ...planet, energyTechnology: 3 },
        lastUpdate: hourAgo,
        now: new Date(),
        config,
      }).resources.metal;
      expect(expectedNew).toBeGreaterThan(expectedOld + 20);

      const entry = await database.researchQueue.create({
        data: {
          userId: p.userId,
          planetId: p.planetId,
          techId: 113,
          level: 3,
          startTime: new Date(Date.now() - 2000),
          endTime: new Date(Date.now() - 1000),
        },
      });
      await research.completeResearch({ id: entry.id, userId: p.userId, techId: 113, level: 3 });

      const after = await database.planet.findUniqueOrThrow({ where: { id: p.planetId } });
      // L'heure passée a été produite avec l'ancien niveau (0), pas le nouveau (3)
      expect(Math.abs(after.metal - expectedOld)).toBeLessThan(Math.abs(after.metal - expectedNew));
      expect(after.metal).toBeCloseTo(expectedOld, 0);
      // …et le nouveau rendement est enregistré à partir de maintenant
      expect(after.energyAvailable).toBe(Math.floor(30 * 5 * Math.pow(1.08, 5)));
    });
  });

  describe('terraformeur', () => {
    it('ajoute 5 cases par niveau et n\'en occupe aucune', async () => {
      const p = await player();
      await setTech(p.userId, 113, 12);
      await database.planet.update({
        where: { id: p.planetId },
        data: { crystal: 100000, deuterium: 200000, fieldsUsed: 3 },
      });
      const before = await database.planet.findUniqueOrThrow({ where: { id: p.planetId } });

      const list = await request(app.getHttpServer())
        .get(`/planets/${p.planetId}/buildings`)
        .set(auth(p.token))
        .expect(200);
      const terraformer = list.body.buildings.find((b: { id: number }) => b.id === 33);
      expect(terraformer.canBuild).toBe(true);
      const fieldsEffect = terraformer.upgrade.effects.find((e: { key: string }) => e.key === 'fields');
      expect(fieldsEffect.next - fieldsEffect.current).toBe(5);

      const build = await request(app.getHttpServer())
        .post(`/planets/${p.planetId}/build`)
        .set(auth(p.token))
        .send({ buildingId: 33 })
        .expect(201);
      expect(build.body).toBeDefined();
      const queued = await database.buildQueue.findFirstOrThrow({
        where: { planetId: p.planetId, buildingId: 33, completed: false },
      });
      await database.buildQueue.update({
        where: { id: queued.id },
        data: { startTime: new Date(Date.now() - 5000), endTime: new Date(Date.now() - 1000) },
      });
      const entry = await database.buildQueue.findUniqueOrThrow({ where: { id: queued.id } });
      await buildings.completeConstruction(entry);

      const after = await database.planet.findUniqueOrThrow({ where: { id: p.planetId } });
      expect(after.terraformer).toBe(1);
      expect(after.fieldsMax).toBe(before.fieldsMax + 5);
      expect(after.fieldsUsed).toBe(before.fieldsUsed);
    });
  });

  describe('éléments non fonctionnels masqués', () => {
    it('ni listés ni acceptés : dépôt d\'alliance (silo, base lunaire, phalange et porte existent)', async () => {
      const p = await player();
      await database.planet.update({ where: { id: p.planetId }, data: { metal: 10000000, crystal: 10000000, deuterium: 10000000 } });
      const list = await request(app.getHttpServer())
        .get(`/planets/${p.planetId}/buildings`)
        .set(auth(p.token))
        .expect(200);
      const ids = list.body.buildings.map((b: { id: number }) => b.id);
      for (const hidden of [34, 41, 42, 43]) expect(ids).not.toContain(hidden);
      expect(ids).toEqual(expect.arrayContaining([1, 2, 3, 4, 12, 14, 15, 21, 22, 23, 24, 31, 33, 44]));
      for (const hidden of [34]) {
        const res = await request(app.getHttpServer())
          .post(`/planets/${p.planetId}/build`)
          .set(auth(p.token))
          .send({ buildingId: hidden })
          .expect(400);
        expect(res.body.message).toContain('pas disponible');
      }
      const all = await request(app.getHttpServer()).get('/buildings').set(auth(p.token)).expect(200);
      expect(all.body.map((b: { id: number }) => b.id)).toContain(44);
      expect(all.body.map((b: { id: number }) => b.id)).not.toContain(34);
    });

    it('ni listée ni acceptée : réseau de recherche intergalactique (l\'expédition existe)', async () => {
      const p = await player();
      await database.planet.update({
        where: { id: p.planetId },
        data: { researchLab: 12, metal: 10000000, crystal: 10000000, deuterium: 10000000 },
      });
      const list = await request(app.getHttpServer())
        .get('/technologies')
        .query({ planetId: p.planetId })
        .set(auth(p.token))
        .expect(200);
      const ids = (list.body.technologies ?? list.body).map((t: { id: number }) => t.id);
      expect(ids).not.toContain(123);
      expect(ids).toContain(124);
      expect(ids).toContain(108);
      for (const hidden of [123]) {
        const res = await request(app.getHttpServer())
          .post('/research')
          .set(auth(p.token))
          .send({ planetId: p.planetId, techId: hidden })
          .expect(400);
        expect(res.body.message).toContain('pas disponible');
      }
    });
  });

  describe('technologie Ordinateur : flottes en vol', () => {
    it('une flotte en vol de base, une de plus par niveau', async () => {
      const a = await player();
      const b = await player();
      await database.ship.create({ data: { planetId: a.planetId, shipId: 202, amount: 20 } });
      await database.planet.update({ where: { id: a.planetId }, data: { deuterium: 100000 } });
      const send = () =>
        request(app.getHttpServer())
          .post('/fleet/send')
          .set(auth(a.token))
          .send({
            planetId: a.planetId,
            toGalaxy: b.planet.galaxy,
            toSystem: b.planet.system,
            toPosition: b.planet.position,
            mission: 3,
            speedPercent: 100,
            ships: { '202': 1 },
          });
      const slots = async () =>
        (
          await request(app.getHttpServer())
            .get(`/fleet/available/${a.planetId}`)
            .set(auth(a.token))
            .expect(200)
        ).body.fleetSlots;

      expect(await slots()).toEqual({ inFlight: 0, max: 1 });
      await send().expect(201);
      expect(await slots()).toEqual({ inFlight: 1, max: 1 });
      const refused = await send().expect(400);
      expect(refused.body.message).toContain('Nombre maximal de flottes en vol');
      expect(await database.fleet.count({ where: { userId: a.userId } })).toBe(1);

      await setTech(a.userId, 108, 2);
      expect((await slots()).max).toBe(3);
      await send().expect(201);
      await send().expect(201);
      await send().expect(400);
      expect(await database.fleet.count({ where: { userId: a.userId } })).toBe(3);
    });

    it('envois simultanés : jamais plus de flottes que d\'emplacements', async () => {
      const a = await player();
      const b = await player();
      await setTech(a.userId, 108, 1); // 2 emplacements
      await database.ship.create({ data: { planetId: a.planetId, shipId: 202, amount: 20 } });
      await database.planet.update({ where: { id: a.planetId }, data: { deuterium: 100000 } });
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          request(app.getHttpServer())
            .post('/fleet/send')
            .set(auth(a.token))
            .send({
              planetId: a.planetId,
              toGalaxy: b.planet.galaxy,
              toSystem: b.planet.system,
              toPosition: b.planet.position,
              mission: 3,
              speedPercent: 100,
              ships: { '202': 1 },
            }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(await database.fleet.count({ where: { userId: a.userId } })).toBe(2);
    });
  });
});
