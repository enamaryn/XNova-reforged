import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { activeQuests, periodKey } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { QuestsService } from '../../src/quests/quests.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Quêtes et succès : progression dérivée de l'activité enregistrée, récompense réclamée une seule fois par
 * période (même sous demandes simultanées), succès débloqués et conservés.
 */
describe('API integration - quêtes et succès', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  const player = async () => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    return { token: accessToken as string, userId: me.body.id as string, planetId: me.body.planets[0].id as string };
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  const list = async (u: Player) => (await request(app.getHttpServer()).get('/quests').set(auth(u)).expect(200)).body;
  const claim = (u: Player, questId: string, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer()).post(`/quests/${questId}/claim`).set(auth(u)).send({ planetId: u.planetId, ...body });
  const planetStock = async (u: Player) => {
    const p = await database.planet.findUniqueOrThrow({ where: { id: u.planetId } });
    return { metal: p.metal, crystal: p.crystal, deuterium: p.deuterium };
  };
  /**
   * Un jour passé où la quête voulue est tirée (l'horloge du service est figée sur ce jour) : la période commence
   * avant les lignes d'activité créées par le test, qui comptent donc bien dans sa fenêtre.
   */
  const dayWhere = (period: 'daily' | 'weekly', questId: string, notWeekly?: string) => {
    for (let day = 1; day < 400; day += 1) {
      const date = new Date(Date.now() - day * 86_400_000);
      if (!activeQuests(period, periodKey(period, date)).some((q) => q.id === questId)) continue;
      // Écarte les jours dont la semaine tire la quête hebdomadaire à refuser (le tirage change chaque semaine).
      if (notWeekly && activeQuests('weekly', periodKey('weekly', date)).some((q) => q.id === notWeekly)) continue;
      return date;
    }
    throw new Error('quête jamais tirée');
  };
  const freezeClock = (date: Date) => jest.spyOn(QuestsService.prototype as any, 'now').mockReturnValue(date);
  const completedBuildings = async (u: Player, count: number) => {
    for (let i = 0; i < count; i += 1) {
      await database.buildQueue.create({
        data: { planetId: u.planetId, buildingId: 1, level: i + 1, startTime: new Date(Date.now() - 2000), endTime: new Date(Date.now() - 1000), completed: true },
      });
    }
  };

  describe('quêtes', () => {
    it('liste trois journalières et deux hebdomadaires, sans progression au départ', async () => {
      const u = await player();
      const body = await list(u);
      expect(body.daily.quests).toHaveLength(3);
      expect(body.weekly.quests).toHaveLength(2);
      expect(new Date(body.daily.resetsAt).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(body.weekly.resetsAt).getTime()).toBeGreaterThanOrEqual(new Date(body.daily.resetsAt).getTime());
      expect(body.rewardMultiplier).toBe(1);
      for (const quest of [...body.daily.quests, ...body.weekly.quests]) {
        expect(quest).toMatchObject({ progress: 0, claimed: false, claimable: false });
        expect(quest.target).toBeGreaterThan(0);
      }
    });

    it('refuse une quête non terminée, inactive ou une planète étrangère, sans rien créditer', async () => {
      const u = await player();
      const other = await player();
      const date = dayWhere('daily', 'daily_build_3', 'weekly_expedition_5');
      freezeClock(date);
      const before = await planetStock(u);
      const early = await claim(u, 'daily_build_3').expect(400);
      expect(early.body.message).toMatch(/non terminee/);
      await claim(u, 'quete_inconnue').expect(404);
      await claim(u, 'weekly_expedition_5').expect(404); // pas tirée cette semaine-là
      await completedBuildings(u, 3);
      await claim(u, 'daily_build_3', { planetId: other.planetId }).expect(404);
      expect(await planetStock(u)).toEqual(before);
      expect(await database.questClaim.count({ where: { userId: u.userId } })).toBe(0);
    });

    it('une quête terminée se réclame une fois : récompense créditée, nouvelle demande refusée', async () => {
      const u = await player();
      freezeClock(dayWhere('daily', 'daily_build_3'));
      await completedBuildings(u, 2);
      let quest = (await list(u)).daily.quests.find((q: any) => q.id === 'daily_build_3');
      expect(quest).toMatchObject({ progress: 2, target: 3, claimable: false });

      await completedBuildings(u, 1);
      quest = (await list(u)).daily.quests.find((q: any) => q.id === 'daily_build_3');
      expect(quest).toMatchObject({ progress: 3, claimable: true, reward: { metal: 20_000, crystal: 0, deuterium: 0 } });

      const before = await planetStock(u);
      const res = await claim(u, 'daily_build_3').expect(201);
      expect(res.body.reward).toEqual({ metal: 20_000, crystal: 0, deuterium: 0 });
      expect((await planetStock(u)).metal).toBe(before.metal + 20_000);

      await claim(u, 'daily_build_3').expect(409);
      expect((await planetStock(u)).metal).toBe(before.metal + 20_000);
      quest = (await list(u)).daily.quests.find((q: any) => q.id === 'daily_build_3');
      expect(quest).toMatchObject({ claimed: true, claimable: false });
    });

    it('deux demandes simultanées ne créditent qu’une fois', async () => {
      const u = await player();
      freezeClock(dayWhere('daily', 'daily_build_3'));
      await completedBuildings(u, 3);
      const before = await planetStock(u);
      const results = await Promise.all([claim(u, 'daily_build_3'), claim(u, 'daily_build_3'), claim(u, 'daily_build_3')]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
      expect((await planetStock(u)).metal).toBe(before.metal + 20_000);
      expect(await database.questClaim.count({ where: { userId: u.userId } })).toBe(1);
    });

    it("la réclamation d'une période précédente ne bloque pas la période suivante", async () => {
      const u = await player();
      const date = dayWhere('daily', 'daily_build_3');
      freezeClock(date);
      await completedBuildings(u, 3);
      await database.questClaim.create({ data: { userId: u.userId, questId: 'daily_build_3', periodKey: '1999-01-01' } });
      await claim(u, 'daily_build_3').expect(201);
      expect(await database.questClaim.count({ where: { userId: u.userId, questId: 'daily_build_3' } })).toBe(2);
    });

    it("l'activité comptée est celle de la fenêtre : une construction antérieure à la période ne compte pas", async () => {
      const u = await player();
      const date = dayWhere('daily', 'daily_build_3');
      freezeClock(date);
      const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      // une construction terminée la veille de la période, une autre terminée depuis son début
      await database.buildQueue.create({
        data: { planetId: u.planetId, buildingId: 1, level: 1, startTime: new Date(dayStart.getTime() - 2 * 86_400_000), endTime: new Date(dayStart.getTime() - 86_400_000), completed: true },
      });
      await completedBuildings(u, 1);
      const quest = (await list(u)).daily.quests.find((q: any) => q.id === 'daily_build_3');
      expect(quest.progress).toBe(1);
    });

    it('la récompense hebdomadaire se réclame aussi (cristal et deutérium inclus)', async () => {
      const u = await player();
      freezeClock(dayWhere('weekly', 'weekly_expedition_5'));
      for (let i = 0; i < 5; i += 1) {
        await database.expeditionReport.create({
          data: { userId: u.userId, galaxy: 1, system: 5, outcome: 'nothing', details: {}, ships: {} },
        });
      }
      const before = await planetStock(u);
      const res = await claim(u, 'weekly_expedition_5').expect(201);
      expect(res.body.reward).toEqual({ metal: 0, crystal: 50_000, deuterium: 80_000 });
      const after = await planetStock(u);
      expect(after.crystal).toBe(before.crystal + 50_000);
      expect(after.deuterium).toBe(before.deuterium + 80_000);
    });
  });

  describe('succès', () => {
    it('une nouvelle partie débloque peu de succès et en liste tous', async () => {
      const u = await player();
      const body = (await request(app.getHttpServer()).get('/achievements').set(auth(u)).expect(200)).body;
      const all = body.categories.flatMap((c: any) => c.achievements);
      expect(all).toHaveLength(body.total);
      expect(body.total).toBeGreaterThanOrEqual(30);
      expect(body.percent).toBe(Math.floor((body.unlocked / body.total) * 100));
      expect(all.find((a: any) => a.id === 'buildings_10')).toMatchObject({ unlocked: false, progress: 0, target: 10 });
      expect(all.find((a: any) => a.id === 'alliance_1').unlocked).toBe(false);
    });

    it("les succès atteints se débloquent une seule fois et restent acquis, la progression est plafonnée à la cible", async () => {
      const u = await player();
      await completedBuildings(u, 12);
      await database.shipQueue.create({
        data: { planetId: u.planetId, shipId: 202, amount: 150, startTime: new Date(Date.now() - 2000), endTime: new Date(Date.now() - 1000), completed: true },
      });
      const get = async () => (await request(app.getHttpServer()).get('/achievements').set(auth(u)).expect(200)).body;
      const first = await get();
      const flat = (b: any) => b.categories.flatMap((c: any) => c.achievements);
      expect(first.newlyUnlocked).toEqual(expect.arrayContaining(['buildings_10', 'units_100']));
      expect(flat(first).find((a: any) => a.id === 'buildings_10')).toMatchObject({ unlocked: true, progress: 10 });
      expect(flat(first).find((a: any) => a.id === 'buildings_100')).toMatchObject({ unlocked: false, progress: 12, target: 100 });
      const unlockedAt = flat(first).find((a: any) => a.id === 'buildings_10').unlockedAt;
      expect(unlockedAt).toBeTruthy();

      const second = await get();
      expect(second.newlyUnlocked).toEqual([]);
      expect(flat(second).find((a: any) => a.id === 'buildings_10').unlockedAt).toBe(unlockedAt);
      expect(await database.achievementUnlock.count({ where: { userId: u.userId, achievementId: 'buildings_10' } })).toBe(1);

      // un succès reste acquis même si l'activité qui l'a produit disparaît
      await database.buildQueue.deleteMany({ where: { planetId: u.planetId } });
      const third = await get();
      expect(flat(third).find((a: any) => a.id === 'buildings_10').unlocked).toBe(true);
    });

    it('des demandes simultanées ne créent pas de doublon', async () => {
      const u = await player();
      await completedBuildings(u, 10);
      await Promise.all([1, 2, 3].map(() => request(app.getHttpServer()).get('/achievements').set(auth(u)).expect(200)));
      expect(await database.achievementUnlock.count({ where: { userId: u.userId, achievementId: 'buildings_10' } })).toBe(1);
    });

    it("les succès sociaux et économiques s'appuient sur l'état réel (alliance, officiers)", async () => {
      const u = await player();
      const alliance = await database.alliance.create({ data: { tag: `Q${Date.now().toString(36).slice(-3).toUpperCase()}`.slice(0, 5), name: 'Quêtes', founderId: u.userId } });
      await database.allianceMember.create({ data: { allianceId: alliance.id, userId: u.userId, rank: 'member' } });
      await database.officer.create({ data: { userId: u.userId, type: 'geologist' } });
      try {
        const body = (await request(app.getHttpServer()).get('/achievements').set(auth(u)).expect(200)).body;
        expect(body.newlyUnlocked).toEqual(expect.arrayContaining(['alliance_1', 'officers_1']));
      } finally {
        await database.alliance.deleteMany({ where: { id: alliance.id } });
      }
    });
  });
});
