import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { INVASION_CONFIG_KEY, INVASION_DEFAULTS, GAME_CONSTANTS, type InvasionConfig } from '@xnova/game-config';
import { BossService } from '../../src/boss/boss.service';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { InvasionService } from '../../src/invasions/invasions.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Invasions aliens : campagne de vagues NPC en position 16, vagues successives plus fortes, butin de vague et butin
 * final au prorata des dégâts, échéance, bonus de production offert, attaque par la mission 1, console admin.
 */
describe('API integration - invasions aliens', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let invasions: InvasionService;
  const users: ReturnType<typeof buildTestUser>[] = [];
  const NOW = new Date('2026-11-04T12:00:00Z');
  let clock = NOW;

  /** Aliens faibles, trois vagues (10, 20, 40 sondes) et butins simples : combats courts et déterministes. */
  const WEAK: InvasionConfig = {
    ...INVASION_DEFAULTS,
    enabled: true,
    waves: 3,
    durationHours: 24,
    waveShips: { 210: 10 },
    waveGrowth: 2,
    tech: { weapon: 0, shield: 0, armor: 0 },
    regenPercentPerHour: 10,
    waveLoot: { metal: 1000, crystal: 500, deuterium: 100 },
    finalLoot: { metal: 10_000, crystal: 5000, deuterium: 1000 },
    rewardProductionBonus: 0.2,
    rewardDays: 2,
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    invasions = app.get(InvasionService);
  });

  afterAll(async () => {
    await database?.invasion.deleteMany();
    await database?.worldEvent.deleteMany({ where: { templateId: 'invasion_victory' } });
    await database?.gameConfig.deleteMany({ where: { key: INVASION_CONFIG_KEY } });
    if (database) for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  beforeEach(async () => {
    clock = NOW;
    jest.spyOn(InvasionService.prototype as any, 'now').mockImplementation(() => clock);
    await database.invasion.deleteMany();
    await database.worldEvent.deleteMany({ where: { templateId: 'invasion_victory' } });
    await database.gameConfig.deleteMany({ where: { key: INVASION_CONFIG_KEY } });
  });

  afterEach(() => jest.restoreAllMocks());

  const setConfig = (config: InvasionConfig) =>
    database.gameConfig.upsert({
      where: { key: INVASION_CONFIG_KEY },
      create: { key: INVASION_CONFIG_KEY, value: JSON.stringify(config) },
      update: { value: JSON.stringify(config) },
    });
  const STOCK = { metal: 500_000, crystal: 300_000, deuterium: 900_000 };
  const account = async (role: 'PLAYER' | 'ADMIN' = 'PLAYER') => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const planet = me.body.planets[0];
    await database.planet.update({ where: { id: planet.id }, data: STOCK });
    if (role !== 'PLAYER') await database.user.update({ where: { id: me.body.id }, data: { role } });
    return { token: accessToken as string, userId: me.body.id as string, planet };
  };
  type Account = Awaited<ReturnType<typeof account>>;
  const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
  const giveShips = (a: Account, shipId: number, amount: number) =>
    database.ship.upsert({
      where: { planetId_shipId: { planetId: a.planet.id, shipId } },
      update: { amount },
      create: { planetId: a.planet.id, shipId, amount },
    });
  /** Lance une invasion dans la galaxie 4 et renvoie sa vague en cours. */
  const startInvasion = async (config = WEAK, galaxy = 4) => {
    await setConfig(config);
    const invasion = (await invasions.start(config, { galaxy }))!;
    const wave = await database.invasionWave.findFirstOrThrow({ where: { invasionId: invasion.id, activeSlot: 1 } });
    return { invasion, wave };
  };
  const engage = (a: Account, ships: Record<number, number>, galaxy: number, system: number) =>
    database.$transaction((tx) => invasions.engage(tx, { userId: a.userId, planetId: a.planet.id, ships, galaxy, system }));
  /** Détruit la vague en cours (flotte de vaisseaux de bataille) et renvoie le résultat du combat. */
  const clearCurrent = async (a: Account, galaxy: number) => {
    const wave = await database.invasionWave.findFirstOrThrow({ where: { activeSlot: 1 } });
    return engage(a, { 207: 500 }, galaxy, wave.system);
  };

  describe('cycle de vie', () => {
    it('est désactivé par défaut : rien ne démarre, l’état le dit', async () => {
      await invasions.tick();
      expect(await database.invasion.count()).toBe(0);
      const u = await account();
      const state = await request(app.getHttpServer()).get('/invasions').set(auth(u)).expect(200);
      expect(state.body).toMatchObject({ enabled: false, invasion: null, nextAuto: null, last: null });
      await request(app.getHttpServer()).get('/invasions').expect(401);
    });

    it('démarre avec sa première vague en position 16, une seule invasion à la fois', async () => {
      const { invasion, wave } = await startInvasion();
      expect(invasion).toMatchObject({ status: 'ACTIVE', activeSlot: 1, galaxy: 4, totalWaves: 3, currentWave: 1 });
      expect(invasion.endsAt.getTime()).toBe(NOW.getTime() + 24 * 3_600_000);
      expect(wave).toMatchObject({ index: 1, status: 'ACTIVE', activeSlot: 1 });
      expect(wave.maxShips).toEqual({ 210: 10 });
      expect(wave.system).toBeGreaterThanOrEqual(1);
      expect(wave.system).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_SYSTEMS);

      // Un second lancement, y compris simultané, ne crée rien de plus
      expect(await invasions.start(WEAK, { galaxy: 5 })).toBeNull();
      const results = await Promise.all([invasions.start(WEAK, { galaxy: 6 }), invasions.start(WEAK, { galaxy: 7 })]);
      expect(results).toEqual([null, null]);
      expect(await database.invasion.count()).toBe(1);
      expect(await database.invasionWave.count()).toBe(1);
    });

    it('lancement automatique : seulement avec un intervalle réglé, une fois, puis après le délai', async () => {
      await setConfig({ ...WEAK, autoIntervalDays: 0 });
      await invasions.tick();
      expect(await database.invasion.count()).toBe(0);

      await setConfig({ ...WEAK, autoIntervalDays: 2 });
      await invasions.tick();
      const first = await database.invasion.findFirstOrThrow();
      expect(first).toMatchObject({ auto: true, status: 'ACTIVE' });
      await invasions.tick();
      expect(await database.invasion.count()).toBe(1);

      // Fin de l'invasion : la suivante attend l'intervalle
      await database.invasion.update({ where: { id: first.id }, data: { status: 'REPELLED', activeSlot: null, finishedAt: NOW } });
      await database.invasionWave.updateMany({ data: { activeSlot: null, status: 'CLEARED' } });
      clock = new Date(NOW.getTime() + 47 * 3_600_000);
      await invasions.tick();
      expect(await database.invasion.count()).toBe(1);
      clock = new Date(NOW.getTime() + 49 * 3_600_000);
      await invasions.tick();
      expect(await database.invasion.count()).toBe(2);
    });

    it('régénère la vague avec le temps, sans dépasser son maximum', async () => {
      const { wave } = await startInvasion({ ...WEAK, waveShips: { 210: 100 } });
      await database.invasionWave.update({ where: { id: wave.id }, data: { ships: { 210: 10 } } });
      clock = new Date(NOW.getTime() + 2 * 3_600_000);
      await invasions.tick();
      expect((await database.invasionWave.findUniqueOrThrow({ where: { id: wave.id } })).ships).toEqual({ 210: 30 });
      clock = new Date(NOW.getTime() + 20 * 3_600_000);
      // Au-delà de l'échéance (24 h) non atteinte : la flotte revient au maximum
      await invasions.tick();
      expect((await database.invasionWave.findUniqueOrThrow({ where: { id: wave.id } })).ships).toEqual({ 210: 100 });
    });

    it('l’échéance dépassée : les aliens se retirent, sans butin, plus de front', async () => {
      const { invasion, wave } = await startInvasion();
      clock = new Date(NOW.getTime() + 25 * 3_600_000);
      await invasions.tick();
      expect(await database.invasion.findUniqueOrThrow({ where: { id: invasion.id } })).toMatchObject({ status: 'FAILED', activeSlot: null, rewardPending: false });
      expect(await database.invasionWave.findUniqueOrThrow({ where: { id: wave.id } })).toMatchObject({ status: 'EXPIRED', activeSlot: null });
      const u = await account();
      expect(await engage(u, { 207: 10 }, invasion.galaxy, wave.system)).toBeNull();
      await expect(invasions.assertFrontAt(invasion.galaxy, wave.system, 16)).rejects.toThrow();
    });

    it('ne laisse pas un combat avoir lieu après l’échéance, même avant le passage du cron', async () => {
      const { invasion, wave } = await startInvasion();
      clock = new Date(NOW.getTime() + 25 * 3_600_000);
      const u = await account();
      expect(await engage(u, { 207: 10 }, invasion.galaxy, wave.system)).toBeNull();
      expect(await database.invasionBattle.count()).toBe(0);
    });
  });

  describe('combat, vagues et butin', () => {
    it('les dégâts persistent entre les combats et s’accumulent par joueur', async () => {
      const { invasion, wave } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waveShips: { 210: 100 } });
      const u = await account();
      const first = await engage(u, { 207: 1 }, invasion.galaxy, wave.system);
      expect(first!.cleared).toBe(false);
      expect(first!.damage).toBeGreaterThan(0);
      const second = await engage(u, { 207: 1 }, invasion.galaxy, wave.system);
      expect(second!.waveHealthAfter).toBeLessThan(first!.waveHealthAfter);
      const row = await database.invasionDamage.findUniqueOrThrow({ where: { waveId_userId: { waveId: wave.id, userId: u.userId } } });
      expect(row.battles).toBe(2);
      expect(row.damage).toBeCloseTo(first!.damage + second!.damage, 5);
    });

    it('la vague détruite partage son butin au prorata des dégâts et fait apparaître la suivante, plus forte', async () => {
      const { invasion, wave } = await startInvasion({ ...WEAK, regenPercentPerHour: 0 });
      const a = await account();
      const b = await account();
      const before = {
        a: (await database.planet.findUniqueOrThrow({ where: { id: a.planet.id } })).metal,
        b: (await database.planet.findUniqueOrThrow({ where: { id: b.planet.id } })).metal,
      };
      // a inflige une partie des dégâts, b achève la vague
      const partial = await engage(a, { 207: 1 }, invasion.galaxy, wave.system);
      expect(partial!.cleared).toBe(false);
      const finisher = await engage(b, { 207: 500 }, invasion.galaxy, wave.system);
      expect(finisher).toMatchObject({ cleared: true, repelled: false, waveIndex: 1 });

      // Butin de vague : somme exacte au plus, répartie selon les dégâts
      const gainA = (await database.planet.findUniqueOrThrow({ where: { id: a.planet.id } })).metal - before.a;
      const gainB = (await database.planet.findUniqueOrThrow({ where: { id: b.planet.id } })).metal - before.b;
      const damageA = (await database.invasionDamage.findUniqueOrThrow({ where: { waveId_userId: { waveId: wave.id, userId: a.userId } } })).damage;
      const damageB = (await database.invasionDamage.findUniqueOrThrow({ where: { waveId_userId: { waveId: wave.id, userId: b.userId } } })).damage;
      expect(gainA).toBe(Math.floor((1000 * damageA) / (damageA + damageB)));
      expect(gainB).toBe(Math.floor((1000 * damageB) / (damageA + damageB)));
      expect(gainA).toBeGreaterThan(0);
      expect(gainB).toBeGreaterThan(0);
      expect(gainA + gainB).toBeLessThanOrEqual(1000);
      expect(gainA + gainB).toBeGreaterThanOrEqual(998);
      expect(finisher!.loot!.metal).toBe(gainB);
      expect(await database.invasionBattle.count({ where: { source: 'LOOT_WAVE' } })).toBe(2);

      // Vague 2 : actuelle, plus forte (20 sondes), dans la même galaxie
      const next = await database.invasionWave.findFirstOrThrow({ where: { activeSlot: 1 } });
      expect(next).toMatchObject({ index: 2, status: 'ACTIVE' });
      expect(next.maxShips).toEqual({ 210: 20 });
      expect(await database.invasionWave.findUniqueOrThrow({ where: { id: wave.id } })).toMatchObject({ status: 'CLEARED', activeSlot: null });
      expect(await database.invasion.findUniqueOrThrow({ where: { id: invasion.id } })).toMatchObject({ currentWave: 2, status: 'ACTIVE' });
    });

    it('la défaite ne coûte que les vaisseaux perdus et ne détruit pas la vague', async () => {
      const { invasion, wave } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waveShips: { 207: 2000 } });
      const u = await account();
      const result = await engage(u, { 202: 3 }, invasion.galaxy, wave.system);
      expect(result).toMatchObject({ cleared: false, repelled: false });
      expect(result!.survivors).toEqual({});
      expect((await database.invasionWave.findUniqueOrThrow({ where: { id: wave.id } })).status).toBe('ACTIVE');
    });

    it('la dernière vague repousse l’invasion : butin final au prorata de tous les dégâts, bonus de production offert une seule fois', async () => {
      const { invasion } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waves: 2 });
      const a = await account();
      const b = await account();
      const metal = async (u: Account) => (await database.planet.findUniqueOrThrow({ where: { id: u.planet.id } })).metal;
      const start = { a: await metal(a), b: await metal(b) };

      // Vague 1 : a la détruit seul ; vague 2 : a inflige peu, b l'achève
      const first = await clearCurrent(a, invasion.galaxy);
      expect(first).toMatchObject({ cleared: true, repelled: false });
      const wave2 = await database.invasionWave.findFirstOrThrow({ where: { activeSlot: 1 } });
      await engage(a, { 207: 1 }, invasion.galaxy, wave2.system);
      const last = await engage(b, { 207: 500 }, invasion.galaxy, wave2.system);
      expect(last).toMatchObject({ cleared: true, repelled: true, waveIndex: 2 });

      const done = await database.invasion.findUniqueOrThrow({ where: { id: invasion.id } });
      expect(done).toMatchObject({ status: 'REPELLED', activeSlot: null, rewardPending: true, rewardProductionBonus: 0.2, rewardDays: 2 });
      expect(done.finishedAt).toEqual(NOW);
      expect(await database.invasionWave.count({ where: { activeSlot: 1 } })).toBe(0);

      // Butin final (10 000 métal) partagé entre a (dégâts des deux vagues) et b, en plus des butins de vague
      const finals = await database.invasionBattle.findMany({ where: { source: 'LOOT_FINAL' } });
      expect(finals).toHaveLength(2);
      const sum = finals.reduce((total, row) => total + ((row.loot as { metal: number }).metal ?? 0), 0);
      expect(sum).toBeLessThanOrEqual(10_000);
      expect(sum).toBeGreaterThanOrEqual(9_998);
      const finalOf = (u: Account) => (finals.find((row) => row.userId === u.userId)!.loot as { metal: number }).metal;
      expect(finalOf(a)).toBeGreaterThan(finalOf(b));
      expect(last!.loot!.metal).toBeGreaterThanOrEqual(finalOf(b));
      expect((await metal(a)) - start.a).toBeGreaterThan(finalOf(a));

      // Bonus : événement du monde créé par le passage suivant, une seule fois
      await invasions.tick();
      await invasions.tick();
      const events = await database.worldEvent.findMany({ where: { templateId: 'invasion_victory' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: 'INVASION', status: 'ACTIVE', productionBonus: 0.2, occurrenceKey: `invasion:${invasion.id}`, launchedById: null });
      expect(events[0].endsAt.getTime() - events[0].startsAt.getTime()).toBe(2 * 86_400_000);
      expect((await database.invasion.findUniqueOrThrow({ where: { id: invasion.id } })).rewardPending).toBe(false);
      const active = await request(app.getHttpServer()).get('/world-events/active').set(auth(a)).expect(200);
      expect(active.body.events.some((e: { templateId: string }) => e.templateId === 'invasion_victory')).toBe(true);
    });

    it('sans bonus réglé (0), aucun événement du monde', async () => {
      const { invasion } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waves: 1, rewardProductionBonus: 0 });
      const u = await account();
      expect(await clearCurrent(u, invasion.galaxy)).toMatchObject({ repelled: true });
      expect((await database.invasion.findUniqueOrThrow({ where: { id: invasion.id } })).rewardPending).toBe(false);
      await invasions.tick();
      expect(await database.worldEvent.count({ where: { templateId: 'invasion_victory' } })).toBe(0);
    });

    it('un bonus déjà lancé (reprise après coupure) n’est pas relancé', async () => {
      const { invasion } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waves: 1 });
      const u = await account();
      await clearCurrent(u, invasion.galaxy);
      await invasions.deliverRewards();
      await database.invasion.update({ where: { id: invasion.id }, data: { rewardPending: true } });
      await invasions.deliverRewards();
      expect(await database.worldEvent.count({ where: { templateId: 'invasion_victory' } })).toBe(1);
      expect((await database.invasion.findUniqueOrThrow({ where: { id: invasion.id } })).rewardPending).toBe(false);
    });
  });

  describe('mission d’attaque vers la position 16', () => {
    const send = (a: Account, galaxy: number, system: number, ships: Record<string, number> = { '207': 30 }) =>
      request(app.getHttpServer())
        .post('/fleet/send')
        .set(auth(a))
        .send({ planetId: a.planet.id, toGalaxy: galaxy, toSystem: system, toPosition: 16, mission: 1, speedPercent: 100, ships });

    it('refuse sans front à ces coordonnées ou invasions désactivées, sans rien débiter', async () => {
      const u = await account();
      await giveShips(u, 207, 30);
      const { invasion, wave } = await startInvasion();
      const wrongSystem = wave.system === 1 ? 2 : 1;
      await send(u, invasion.galaxy, wrongSystem).expect(400);
      await send(u, invasion.galaxy === 1 ? 2 : 1, wave.system).expect(400);
      await setConfig({ ...WEAK, enabled: false });
      await send(u, invasion.galaxy, wave.system).expect(400);
      expect(await database.fleet.count({ where: { userId: u.userId } })).toBe(0);
      expect((await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: u.planet.id, shipId: 207 } } })).amount).toBe(30);
    });

    it('envoie la flotte, la résout à l’arrivée (vague détruite, butin crédité) et ramène les survivants', async () => {
      const { invasion, wave } = await startInvasion({ ...WEAK, regenPercentPerHour: 0 });
      const u = await account();
      await giveShips(u, 207, 100);
      const sent = await send(u, invasion.galaxy, wave.system, { '207': 100 }).expect(201);
      await database.fleet.update({ where: { id: sent.body.fleetId }, data: { arrivalTime: new Date(Date.now() - 1000) } });
      await app.get(FleetCronService).handleFleetStatus();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: sent.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(Object.values(fleet.ships as Record<string, number>).reduce((n, v) => n + v, 0)).toBeGreaterThan(0);
      expect(await database.invasionBattle.count({ where: { userId: u.userId, source: 'ATTACK', cleared: true } })).toBe(1);
      expect(await database.invasionWave.count({ where: { invasionId: invasion.id, status: 'CLEARED' } })).toBe(1);
    });

    it('si le front a disparu avant l’arrivée, la flotte rentre intacte', async () => {
      const { invasion, wave } = await startInvasion();
      const u = await account();
      await giveShips(u, 207, 100);
      const sent = await send(u, invasion.galaxy, wave.system, { '207': 100 }).expect(201);
      await invasions.adminCancel((await account('ADMIN')).userId);
      await database.fleet.update({ where: { id: sent.body.fleetId }, data: { arrivalTime: new Date(Date.now() - 1000) } });
      await app.get(FleetCronService).handleFleetStatus();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: sent.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(fleet.ships).toEqual({ '207': 100 });
    });

    it('le boss, quand il est dans le système, garde la priorité', async () => {
      const { invasion } = await startInvasion();
      const u = await account();
      await giveShips(u, 207, 100);
      const config = { enabled: true } as never;
      void config;
      await database.gameConfig.upsert({
        where: { key: 'boss.config' },
        create: { key: 'boss.config', value: JSON.stringify({ enabled: true, ships: { 210: 5 }, tech: { weapon: 0, shield: 0, armor: 0 }, respawnDays: 7, aggroChance: 0, regenPercentPerHour: 0, loot: { metal: 10, crystal: 10, deuterium: 10 } }) },
        update: { value: JSON.stringify({ enabled: true, ships: { 210: 5 }, tech: { weapon: 0, shield: 0, armor: 0 }, respawnDays: 7, aggroChance: 0, regenPercentPerHour: 0, loot: { metal: 10, crystal: 10, deuterium: 10 } }) },
      });
      const boss = await app.get(BossService).spawn((await app.get(BossService).config()), { galaxy: invasion.galaxy, system: 77 });
      try {
        expect(boss).not.toBeNull();
        await send(u, invasion.galaxy, 77).expect(201);
        expect(await database.fleet.count({ where: { userId: u.userId } })).toBe(1);
      } finally {
        await database.galacticBoss.deleteMany();
        await database.gameConfig.deleteMany({ where: { key: 'boss.config' } });
      }
    });
  });

  describe('console admin', () => {
    it('réserve la lecture et les modifications aux administrateurs', async () => {
      const player = await account();
      await request(app.getHttpServer()).get('/admin/invasions').expect(401);
      await request(app.getHttpServer()).get('/admin/invasions').set(auth(player)).expect(403);
      await request(app.getHttpServer()).put('/admin/invasions/config').set(auth(player)).send(WEAK).expect(403);
      await request(app.getHttpServer()).post('/admin/invasions/start').set(auth(player)).send({}).expect(403);
      await request(app.getHttpServer()).post('/admin/invasions/cancel').set(auth(player)).expect(403);
    });

    it('enregistre un réglage valide (audité), refuse un réglage invalide sans rien enregistrer, remet aux défauts', async () => {
      const admin = await account('ADMIN');
      const ok = await request(app.getHttpServer()).put('/admin/invasions/config').set(auth(admin)).send(WEAK).expect(200);
      expect(ok.body.config).toMatchObject({ enabled: true, waves: 3 });
      const audit = await database.adminAuditLog.findFirstOrThrow({ where: { userId: admin.userId, action: 'update_invasion' }, orderBy: { createdAt: 'desc' } });
      expect((audit.changes as any).after.waves).toBe(3);

      const bad = await request(app.getHttpServer())
        .put('/admin/invasions/config')
        .set(auth(admin))
        .send({ ...WEAK, waves: 0, waveGrowth: 9, waveShips: { 212: 5 } })
        .expect(400);
      expect(String(bad.body.message)).toMatch(/waves/);
      expect(String(bad.body.message)).toMatch(/waveGrowth/);
      expect(String(bad.body.message)).toMatch(/waveShips/);
      expect((await invasions.config()).waves).toBe(3);

      const reset = await request(app.getHttpServer()).delete('/admin/invasions/config').set(auth(admin)).expect(200);
      expect(reset.body.config).toEqual(INVASION_DEFAULTS);
    });

    it('lance une invasion à la demande (même désactivées), refuse une seconde, puis l’annule sans butin', async () => {
      const admin = await account('ADMIN');
      const started = await request(app.getHttpServer()).post('/admin/invasions/start').set(auth(admin)).send({ galaxy: 3 }).expect(201);
      expect(started.body.invasion).toMatchObject({ galaxy: 3, currentWave: 1, totalWaves: INVASION_DEFAULTS.waves });
      expect(started.body.invasion.wave).toMatchObject({ index: 1 });
      await request(app.getHttpServer()).post('/admin/invasions/start').set(auth(admin)).send({}).expect(400);
      await request(app.getHttpServer()).post('/admin/invasions/start').set(auth(admin)).send({ galaxy: 99 }).expect(400);

      const cancelled = await request(app.getHttpServer()).post('/admin/invasions/cancel').set(auth(admin)).expect(201);
      expect(cancelled.body.invasion).toBeNull();
      expect(cancelled.body.history[0]).toMatchObject({ status: 'CANCELLED' });
      expect(await database.invasionWave.count({ where: { activeSlot: 1 } })).toBe(0);
      await request(app.getHttpServer()).post('/admin/invasions/cancel').set(auth(admin)).expect(404);
      expect(await database.adminAuditLog.count({ where: { userId: admin.userId, action: { in: ['start_invasion', 'cancel_invasion'] } } })).toBe(2);
    });
  });

  describe('lecture joueur', () => {
    it('montre la vague en cours, la progression, le classement et mes combats', async () => {
      const { invasion, wave } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waveShips: { 210: 100 } });
      const a = await account();
      const b = await account();
      await engage(a, { 207: 2 }, invasion.galaxy, wave.system);
      await engage(b, { 207: 1 }, invasion.galaxy, wave.system);
      await database.invasionBattle.count();
      const state = await request(app.getHttpServer()).get('/invasions').set(auth(a)).expect(200);
      expect(state.body.enabled).toBe(true);
      expect(state.body.invasion).toMatchObject({
        galaxy: invasion.galaxy,
        currentWave: 1,
        totalWaves: 3,
        clearedWaves: 0,
        participants: 2,
        wave: { index: 1, system: wave.system, position: 16 },
      });
      expect(state.body.invasion.wave.health).toBeLessThan(1);
      expect(state.body.invasion.top).toHaveLength(2);
      expect(state.body.invasion.top[0].damage).toBeGreaterThan(state.body.invasion.top[1].damage);
      expect(state.body.invasion.mine.damage).toBeGreaterThan(0);
      expect(state.body.battles).toHaveLength(1);
      expect(state.body.battles[0]).toMatchObject({ source: 'ATTACK', waveIndex: 1 });
    });

    it('la suppression du compte d’un participant efface ses dégâts et ses combats, pas ceux des autres', async () => {
      const { invasion, wave } = await startInvasion({ ...WEAK, regenPercentPerHour: 0, waveShips: { 210: 100 } });
      const a = await account();
      const b = await account();
      await engage(a, { 207: 2 }, invasion.galaxy, wave.system);
      await engage(b, { 207: 2 }, invasion.galaxy, wave.system);
      const user = users[users.length - 2];
      await request(app.getHttpServer()).post('/auth/delete-account').set(auth(a)).send({ password: user.password }).expect(200);
      expect(await database.invasionDamage.count({ where: { userId: a.userId } })).toBe(0);
      expect(await database.invasionBattle.count({ where: { userId: a.userId } })).toBe(0);
      expect(await database.invasionDamage.count({ where: { userId: b.userId } })).toBe(1);
    });
  });
});
