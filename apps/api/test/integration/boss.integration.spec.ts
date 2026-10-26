import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { BOSS_CONFIG_KEY, BOSS_DEFAULTS, GAME_CONSTANTS, type BossConfig } from '@xnova/game-config';
import { BossService } from '../../src/boss/boss.service';
import { DatabaseService } from '../../src/database/database.service';
import { ExpeditionService } from '../../src/fleet/expedition.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Boss galactiques : apparition unique, dégâts persistants et régénération, partage du butin à la mort,
 * réapparition après le délai, attaque par la mission 1 vers la position 16, interception d'une expédition,
 * réglages admin validés et audités.
 */
describe('API integration - boss galactiques', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let boss: BossService;
  const users: ReturnType<typeof buildTestUser>[] = [];
  const NOW = new Date('2026-10-26T12:00:00Z');
  let clock = NOW;

  /** Boss faible et butin simple : les combats sont courts et leurs issues déterministes. */
  const WEAK: BossConfig = {
    ...BOSS_DEFAULTS,
    enabled: true,
    aggroChance: 1,
    regenPercentPerHour: 10,
    ships: { 210: 20 },
    tech: { weapon: 0, shield: 0, armor: 0 },
    loot: { metal: 1000, crystal: 500, deuterium: 100 },
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    boss = app.get(BossService);
  });

  afterAll(async () => {
    await database?.galacticBoss.deleteMany();
    await database?.gameConfig.deleteMany({ where: { key: BOSS_CONFIG_KEY } });
    if (database) for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  beforeEach(async () => {
    clock = NOW;
    jest.spyOn(BossService.prototype as any, 'now').mockImplementation(() => clock);
    await database.galacticBoss.deleteMany();
    await database.gameConfig.deleteMany({ where: { key: BOSS_CONFIG_KEY } });
  });

  afterEach(() => jest.restoreAllMocks());

  const setConfig = (config: BossConfig) =>
    database.gameConfig.upsert({
      where: { key: BOSS_CONFIG_KEY },
      create: { key: BOSS_CONFIG_KEY, value: JSON.stringify(config) },
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
  const spawnAt = async (galaxy = 3, system = 123, config = WEAK) => {
    await setConfig(config);
    return (await boss.spawn(config, { galaxy, system }))!;
  };
  /** Combat direct (dans une transaction) d'un joueur contre le boss. */
  const engage = (a: Account, ships: Record<number, number>, galaxy: number, system: number, source: 'ATTACK' | 'EXPEDITION' = 'ATTACK') =>
    database.$transaction((tx) => boss.engage(tx, { userId: a.userId, planetId: a.planet.id, ships, source, galaxy, system }));

  describe('cycle de vie', () => {
    it('est désactivé par défaut : rien n’apparaît, l’état le dit', async () => {
      await boss.tick();
      expect(await database.galacticBoss.count()).toBe(0);
      const u = await account();
      const state = await request(app.getHttpServer()).get('/boss').set(auth(u)).expect(200);
      expect(state.body).toMatchObject({ enabled: false, boss: null, nextSpawn: null });
      await request(app.getHttpServer()).get('/boss').expect(401);
    });

    it('apparaît une fois activé, à un endroit tiré au hasard en position 16, un seul à la fois', async () => {
      await setConfig(WEAK);
      jest.spyOn(BossService.prototype as any, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.25).mockReturnValueOnce(0.5);
      await boss.tick();
      await boss.tick();
      await boss.tick();
      const rows = await database.galacticBoss.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'ALIVE', activeSlot: 1, galaxy: 1 + Math.floor(0.5 * GAME_CONSTANTS.MAX_GALAXIES) });
      expect(rows[0].maxShips).toEqual({ 210: 20 });
      const u = await account();
      const state = await request(app.getHttpServer()).get('/boss').set(auth(u)).expect(200);
      expect(state.body.boss).toMatchObject({ position: 16, health: 1, ships: { 210: 20 } });
    });

    it('deux apparitions simultanées ne créent qu’un boss', async () => {
      await setConfig(WEAK);
      const results = await Promise.all([boss.spawn(WEAK), boss.spawn(WEAK), boss.spawn(WEAK)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await database.galacticBoss.count()).toBe(1);
    });

    it('régénère sa flotte avec le temps, sans dépasser le maximum', async () => {
      const b = await spawnAt();
      const u = await account();
      await engage(u, { 207: 2 }, b.galaxy, b.system);
      const hurt = await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } });
      const lost = 20 - (hurt.ships as Record<string, number>)['210'];
      expect(lost).toBeGreaterThan(0);
      clock = new Date(NOW.getTime() + 3_600_000);
      const state = await request(app.getHttpServer()).get('/boss').set(auth(u)).expect(200);
      expect(state.body.boss.ships['210']).toBeGreaterThan(20 - lost);
      await boss.tick();
      const healed = await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } });
      expect((healed.ships as Record<string, number>)['210']).toBeLessThanOrEqual(20);
      clock = new Date(NOW.getTime() + 24 * 3_600_000);
      await boss.tick();
      expect(((await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } })).ships as Record<string, number>)['210']).toBe(20);
    });
  });

  describe('combat et butin', () => {
    it('les dégâts persistent entre les combats et s’accumulent par joueur', async () => {
      const b = await spawnAt(3, 200, { ...WEAK, regenPercentPerHour: 0, ships: { 210: 2000 } });
      const u = await account();
      await engage(u, { 207: 2 }, b.galaxy, b.system);
      const first = await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } });
      await engage(u, { 207: 2 }, b.galaxy, b.system);
      const second = await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } });
      expect((second.ships as Record<string, number>)['210']).toBeLessThan((first.ships as Record<string, number>)['210']);
      const damage = await database.bossDamage.findUniqueOrThrow({ where: { bossId_userId: { bossId: b.id, userId: u.userId } } });
      expect(damage.battles).toBe(2);
      expect(damage.damage).toBeGreaterThan(0);
      expect(await database.bossBattle.count({ where: { userId: u.userId, source: 'ATTACK' } })).toBe(2);
    });

    it('la mort du boss partage le butin au prorata des dégâts et programme la réapparition', async () => {
      const b = await spawnAt(5, 77, { ...WEAK, regenPercentPerHour: 0, ships: { 210: 200 } });
      const big = await account();
      const small = await account();
      const smallBefore = await database.planet.findUniqueOrThrow({ where: { id: small.planet.id } });
      const bigBefore = await database.planet.findUniqueOrThrow({ where: { id: big.planet.id } });
      // Un petit coup, puis une flotte qui achève le boss
      await engage(small, { 207: 2 }, b.galaxy, b.system);
      const finisher = await engage(big, { 207: 300 }, b.galaxy, b.system);
      expect(finisher).toMatchObject({ killed: true, result: 'attacker_win' });
      const dead = await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } });
      expect(dead).toMatchObject({ status: 'DEAD', activeSlot: null, killedById: big.userId });
      expect(dead.respawnAt!.toISOString()).toBe(new Date(NOW.getTime() + 7 * 86_400_000).toISOString());
      const shares = await database.bossBattle.findMany({ where: { bossId: b.id, source: 'LOOT' } });
      expect(shares).toHaveLength(2);
      const total = shares.reduce((sum, row) => sum + ((row.loot as any).metal as number), 0);
      expect(total).toBeLessThanOrEqual(1000);
      expect(total).toBeGreaterThan(900);
      const bigAfter = await database.planet.findUniqueOrThrow({ where: { id: big.planet.id } });
      const smallAfter = await database.planet.findUniqueOrThrow({ where: { id: small.planet.id } });
      expect(bigAfter.metal - bigBefore.metal).toBeGreaterThan(smallAfter.metal - smallBefore.metal);
      expect(smallAfter.metal - smallBefore.metal).toBeGreaterThan(0);
      expect(finisher!.loot!.metal).toBe(bigAfter.metal - bigBefore.metal);
      // Plus de boss vivant : un nouveau combat est refusé
      expect(await engage(big, { 207: 1 }, b.galaxy, b.system)).toBeNull();
    });

    it('la défaite ne coûte que les vaisseaux perdus et ne tue pas le boss', async () => {
      const b = await spawnAt(2, 50, { ...WEAK, regenPercentPerHour: 0, ships: { 207: 500 } });
      const u = await account();
      const result = await engage(u, { 202: 3 }, b.galaxy, b.system);
      expect(result).toMatchObject({ result: 'defender_win', killed: false });
      expect(Object.values(result!.survivors).reduce((s, n) => s + n, 0)).toBe(0);
      expect((await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('ALIVE');
    });

    it('réapparaît ailleurs une fois le délai écoulé, pas avant', async () => {
      const b = await spawnAt(5, 77, { ...WEAK, regenPercentPerHour: 0, ships: { 210: 5 } });
      const u = await account();
      await engage(u, { 207: 50 }, b.galaxy, b.system);
      expect((await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('DEAD');
      await boss.tick();
      expect(await database.galacticBoss.count({ where: { status: 'ALIVE' } })).toBe(0);
      clock = new Date(NOW.getTime() + 7 * 86_400_000 + 1000);
      jest.spyOn(BossService.prototype as any, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      await boss.tick();
      const alive = await database.galacticBoss.findMany({ where: { status: 'ALIVE' } });
      expect(alive).toHaveLength(1);
      expect(alive[0].id).not.toBe(b.id);
      expect(alive[0].maxShips).toEqual({ 210: 5 });
    });
  });

  describe('mission d’attaque vers la position 16', () => {
    const send = (u: Account, galaxy: number, system: number, mission = 1, position = 16) =>
      request(app.getHttpServer())
        .post('/fleet/send')
        .set(auth(u))
        .send({ planetId: u.planet.id, toGalaxy: galaxy, toSystem: system, toPosition: position, mission, speedPercent: 100, ships: { '207': 30 }, cargo: {} });

    it('refuse sans boss vivant à ces coordonnées, boss désactivé ou position 16 sans boss, sans rien débiter', async () => {
      const u = await account();
      await giveShips(u, 207, 100);
      await send(u, 4, 44).expect(400); // aucun boss
      const b = await spawnAt(6, 66);
      await send(u, 6, 67).expect(400); // mauvais système
      await send(u, 7, 66).expect(400); // mauvaise galaxie
      await setConfig({ ...WEAK, enabled: false });
      const disabled = await send(u, b.galaxy, b.system).expect(400);
      expect(disabled.body.message).toMatch(/boss/);
      expect((await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: u.planet.id, shipId: 207 } } })).amount).toBe(100);
      expect(await database.fleet.count({ where: { userId: u.userId } })).toBe(0);
      // Les autres missions vers la position 16 restent refusées
      await setConfig(WEAK);
      await send(u, b.galaxy, b.system, 3).expect(400);
      await send(u, b.galaxy, b.system, 2).expect(400);
    });

    it('envoie la flotte, la résout à l’arrivée (boss mort, butin crédité) et ramène les survivants', async () => {
      const b = await spawnAt(6, 66, { ...WEAK, regenPercentPerHour: 0, ships: { 210: 30 } });
      const u = await account();
      await giveShips(u, 207, 100);
      const sent = await send(u, b.galaxy, b.system).expect(201);
      expect(sent.body.fleetId).toBeTruthy();
      const before = await database.planet.findUniqueOrThrow({ where: { id: u.planet.id } });
      await database.fleet.update({ where: { id: sent.body.fleetId }, data: { arrivalTime: new Date(Date.now() - 1000) } });
      await app.get(FleetCronService).handleFleetStatus();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: sent.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(Object.values(fleet.ships as Record<string, number>).reduce((s, n) => s + n, 0)).toBeGreaterThan(0);
      const dead = await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } });
      expect(dead.status).toBe('DEAD');
      expect(dead.killedById).toBe(u.userId);
      const after = await database.planet.findUniqueOrThrow({ where: { id: u.planet.id } });
      expect(after.metal).toBeGreaterThanOrEqual(before.metal + 1000 - 5); // butin entier (production en cours comprise)
      const state = await request(app.getHttpServer()).get('/boss').set(auth(u)).expect(200);
      expect(state.body.battles.some((row: any) => row.source === 'ATTACK' && row.killed)).toBe(true);
      expect(state.body.battles.some((row: any) => row.source === 'LOOT')).toBe(true);
    });

    it('une flotte entièrement détruite disparaît, sa cargaison avec elle', async () => {
      const b = await spawnAt(6, 66, { ...WEAK, regenPercentPerHour: 0, ships: { 207: 2000 } });
      const u = await account();
      await giveShips(u, 202, 3);
      const res = await request(app.getHttpServer())
        .post('/fleet/send')
        .set(auth(u))
        .send({ planetId: u.planet.id, toGalaxy: b.galaxy, toSystem: b.system, toPosition: 16, mission: 1, speedPercent: 100, ships: { '202': 3 }, cargo: { metal: 100 } })
        .expect(201);
      await database.fleet.update({ where: { id: res.body.fleetId }, data: { arrivalTime: new Date(Date.now() - 1000) } });
      await app.get(FleetCronService).handleFleetStatus();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet).toMatchObject({ status: 'completed', ships: {}, cargo: {} });
    });

    it('si le boss est mort avant l’arrivée, la flotte rentre intacte', async () => {
      const b = await spawnAt(6, 66);
      const u = await account();
      await giveShips(u, 207, 100);
      const sent = await send(u, b.galaxy, b.system).expect(201);
      await database.galacticBoss.updateMany({ where: { id: b.id }, data: { status: 'DEAD', activeSlot: null } });
      await database.fleet.update({ where: { id: sent.body.fleetId }, data: { arrivalTime: new Date(Date.now() - 1000) } });
      await app.get(FleetCronService).handleFleetStatus();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: sent.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(fleet.ships).toEqual({ '207': 30 });
    });
  });

  describe('interception d’une expédition', () => {
    const expeditionFleet = async (u: Account, galaxy: number, system: number, ships: Record<string, number>) =>
      database.fleet.create({
        data: {
          userId: u.userId,
          fromGalaxy: u.planet.galaxy,
          fromSystem: u.planet.system,
          fromPosition: u.planet.position,
          toGalaxy: galaxy,
          toSystem: system,
          toPosition: 16,
          mission: 15,
          ships,
          cargo: {},
          status: 'traveling',
          startTime: new Date(Date.now() - 7200_000),
          arrivalTime: new Date(Date.now() - 3600_000),
        },
      });

    it('le boss du système attaque l’expédition (chance à 100 %) : combat, rapport et retour des survivants', async () => {
      const b = await spawnAt(8, 88, { ...WEAK, regenPercentPerHour: 0, ships: { 210: 10 } });
      const u = await account();
      const fleet = await expeditionFleet(u, b.galaxy, b.system, { '207': 50 });
      expect(await app.get(ExpeditionService).resolveExpedition(fleet as any)).toBe(true);
      const report = await database.expeditionReport.findFirstOrThrow({ where: { userId: u.userId } });
      expect(report.outcome).toBe('boss');
      expect((report.details as any).killed).toBe(true);
      const after = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
      expect(after.status).toBe('returning');
      expect(await database.bossBattle.count({ where: { userId: u.userId, source: 'EXPEDITION' } })).toBe(1);
    });

    it('une expédition détruite par le boss ne revient pas', async () => {
      const b = await spawnAt(8, 88, { ...WEAK, regenPercentPerHour: 0, ships: { 207: 2000 } });
      const u = await account();
      const fleet = await expeditionFleet(u, b.galaxy, b.system, { '202': 2 });
      await app.get(ExpeditionService).resolveExpedition(fleet as any);
      expect((await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } })).status).toBe('completed');
      expect((await database.galacticBoss.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('ALIVE');
    });

    it('chance nulle ou autre système : l’expédition suit son cours normal, sans combat', async () => {
      const b = await spawnAt(8, 88, { ...WEAK, aggroChance: 0 });
      const u = await account();
      const calm = await expeditionFleet(u, b.galaxy, b.system, { '202': 2 });
      await app.get(ExpeditionService).resolveExpedition(calm as any);
      await setConfig(WEAK);
      const elsewhere = await expeditionFleet(u, b.galaxy, b.system + 1, { '202': 2 });
      await app.get(ExpeditionService).resolveExpedition(elsewhere as any);
      expect(await database.bossBattle.count({ where: { userId: u.userId } })).toBe(0);
      const reports = await database.expeditionReport.findMany({ where: { userId: u.userId } });
      expect(reports.every((r) => r.outcome !== 'boss')).toBe(true);
    });

    it('boss désactivé : aucune interception', async () => {
      const b = await spawnAt(8, 88);
      await setConfig({ ...WEAK, enabled: false });
      const u = await account();
      const fleet = await expeditionFleet(u, b.galaxy, b.system, { '202': 2 });
      await app.get(ExpeditionService).resolveExpedition(fleet as any);
      expect(await database.bossBattle.count({ where: { userId: u.userId } })).toBe(0);
    });
  });

  describe('console admin', () => {
    it('réserve la lecture et les modifications aux administrateurs', async () => {
      const player = await account();
      await request(app.getHttpServer()).get('/admin/boss').set(auth(player)).expect(403);
      await request(app.getHttpServer()).put('/admin/boss/config').set(auth(player)).send(WEAK).expect(403);
      await request(app.getHttpServer()).delete('/admin/boss/config').set(auth(player)).expect(403);
      await request(app.getHttpServer()).post('/admin/boss/spawn').set(auth(player)).send({}).expect(403);
      await request(app.getHttpServer()).post('/admin/boss/despawn').set(auth(player)).expect(403);
      const admin = await account('ADMIN');
      const res = await request(app.getHttpServer()).get('/admin/boss').set(auth(admin)).expect(200);
      expect(res.body.config).toEqual(BOSS_DEFAULTS);
      expect(res.body.boss).toBeNull();
      expect(res.body.sellableShips.map((s: any) => s.id)).not.toContain(212);
    });

    it('enregistre un réglage valide (audité), refuse un réglage invalide sans rien enregistrer, remet aux défauts', async () => {
      const admin = await account('ADMIN');
      const bad = await request(app.getHttpServer()).put('/admin/boss/config').set(auth(admin)).send({ ...WEAK, aggroChance: 2 }).expect(400);
      expect(bad.body.message).toMatch(/aggroChance/);
      await request(app.getHttpServer()).put('/admin/boss/config').set(auth(admin)).send({ ...WEAK, ships: { 212: 3 } }).expect(400);
      await request(app.getHttpServer()).put('/admin/boss/config').set(auth(admin)).send({}).expect(400);
      expect(await database.gameConfig.count({ where: { key: BOSS_CONFIG_KEY } })).toBe(0);
      await request(app.getHttpServer()).put('/admin/boss/config').set(auth(admin)).send({ ...WEAK, respawnDays: 3 }).expect(200);
      const audit = await database.adminAuditLog.findFirstOrThrow({ where: { userId: admin.userId, action: 'update_boss' }, orderBy: { createdAt: 'desc' } });
      expect((audit.changes as any).after.respawnDays).toBe(3);
      expect((audit.changes as any).before.respawnDays).toBe(7);
      const reset = await request(app.getHttpServer()).delete('/admin/boss/config').set(auth(admin)).expect(200);
      expect(reset.body.config).toEqual(BOSS_DEFAULTS);
    });

    it('fait apparaître le boss à la demande, refuse un second, puis le retire sans butin', async () => {
      const admin = await account('ADMIN');
      await request(app.getHttpServer()).put('/admin/boss/config').set(auth(admin)).send(WEAK).expect(200);
      const spawned = await request(app.getHttpServer()).post('/admin/boss/spawn').set(auth(admin)).send({ galaxy: 2, system: 222 }).expect(201);
      expect(spawned.body.boss).toMatchObject({ galaxy: 2, system: 222 });
      await request(app.getHttpServer()).post('/admin/boss/spawn').set(auth(admin)).send({}).expect(400);
      await request(app.getHttpServer()).post('/admin/boss/spawn').set(auth(admin)).send({ galaxy: 99 }).expect(400);
      const gone = await request(app.getHttpServer()).post('/admin/boss/despawn').set(auth(admin)).expect(201);
      expect(gone.body.boss).toBeNull();
      expect(gone.body.history[0]).toMatchObject({ galaxy: 2, system: 222 });
      expect(await database.bossBattle.count({ where: { source: 'LOOT' } })).toBe(0);
      await request(app.getHttpServer()).post('/admin/boss/despawn').set(auth(admin)).expect(404);
      const actions = await database.adminAuditLog.findMany({ where: { userId: admin.userId, action: { in: ['spawn_boss', 'despawn_boss'] } } });
      expect(actions).toHaveLength(2);
    });
  });
});
