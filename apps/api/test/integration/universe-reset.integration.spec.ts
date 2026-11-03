import { PrismaClient } from '@prisma/client';
import { ABANDONED_USERNAME, GAME_CONSTANTS } from '@xnova/game-config';
import { createStarterPlanetWithRetry } from '../../src/auth/starter-planet';
import { run, UniverseResetHooks, UNIVERSE_RESET_KEY } from '../../src/cli/universe-reset';
import { CliDeps } from '../../src/cli/common';
import { useIsolatedSchema } from './helpers';

/**
 * `npm run universe:reset` : remise à zéro des planètes en gardant les comptes (docs/REMISE_A_ZERO.md).
 * Schéma PostgreSQL dédié : la commande efface les données de tout l'univers.
 */
describe('Remise à zéro de l\'univers (universe:reset)', () => {
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;
  let db: PrismaClient;

  const makeIo = (answers: string[] = []) => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: {
        out: (m: string) => out.push(m),
        err: (m: string) => err.push(m),
        ask: async () => answers.shift() ?? '',
      },
    };
  };
  const deps = (io: CliDeps['io']): CliDeps => ({ db, io, env: {} });
  const hooks = (overrides: Partial<UniverseResetHooks> = {}): UniverseResetHooks => ({
    backup: async () => '/backups/xnova_backup_test.sql.gz',
    apiIsRunning: async () => false,
    starterPlanet: createStarterPlanetWithRetry,
    ...overrides,
  });

  const ids: { admin: string; alice: string; bob: string; ghost: string; abandoned: string; alliance: string } = {} as never;
  let abandonedPlanetId: string;
  let oldAlicePlanetId: string;
  let sessionId: string;

  /** Données de jeu dans (presque) toutes les tables concernées. */
  const seed = async () => {
    const mk = (username: string, role: 'PLAYER' | 'SUPER_ADMIN' = 'PLAYER') =>
      db.user.create({
        data: { username, email: `${username}@example.test`, password: `hash-${username}`, role, points: 1234, rank: 7, locale: 'de', termsVersion: '2026-11-03.2' },
      });
    const [admin, alice, bob, abandoned] = await Promise.all([mk('rz_admin', 'SUPER_ADMIN'), mk('rz_alice'), mk('rz_bob'), mk(ABANDONED_USERNAME)]);
    Object.assign(ids, { admin: admin.id, alice: alice.id, bob: bob.id, abandoned: abandoned.id });

    const planetOf = async (userId: string, overrides: Record<string, unknown> = {}) =>
      db.planet.create({
        data: { userId, name: 'Vieille planète', galaxy: 1, system: 1, position: 1, planetType: 'normal', metal: 9_999_999, crystal: 8_888_888, deuterium: 7_777_777, fieldsMax: 163, fieldsUsed: 40, ...overrides },
      });
    const pa = await planetOf(alice.id, { position: 1 });
    oldAlicePlanetId = pa.id;
    const pb = await planetOf(bob.id, { position: 2 });
    await planetOf(admin.id, { position: 3 });
    await planetOf(alice.id, { position: 1, isMoon: true, name: 'Lune' });
    const ab = await planetOf(abandoned.id, { position: 4, name: 'Planète abandonnée' });
    abandonedPlanetId = ab.id;

    await db.buildQueue.create({ data: { planetId: pa.id, buildingId: 1, level: 2, startTime: new Date(), endTime: new Date(Date.now() + 60_000) } });
    await db.ship.create({ data: { planetId: pa.id, shipId: 202, amount: 5 } });
    await db.defense.create({ data: { planetId: pa.id, defenseId: 401, amount: 5 } });
    await db.technology.create({ data: { userId: alice.id, techId: 106, level: 3 } });
    await db.researchQueue.create({ data: { userId: alice.id, planetId: pa.id, techId: 106, level: 4, startTime: new Date(), endTime: new Date(Date.now() + 60_000) } as never });

    const group = await db.attackGroup.create({
      data: { creatorId: alice.id, allianceId: 'x', toGalaxy: 1, toSystem: 1, toPosition: 2, arrivalTime: new Date(), plannedArrivalTime: new Date() },
    });
    const commander = await db.fleetCommander.create({ data: { userId: alice.id, name: 'Nova' } });
    await db.fleet.create({
      data: {
        userId: alice.id, fromGalaxy: 1, fromSystem: 1, fromPosition: 1, toGalaxy: 1, toSystem: 1, toPosition: 2, mission: 1,
        ships: { '202': 1 }, cargo: {}, status: 'traveling', startTime: new Date(), arrivalTime: new Date(Date.now() + 3600_000),
        groupId: group.id, commanderId: commander.id,
      },
    });
    await db.missileStrike.create({
      data: { userId: alice.id, targetUserId: bob.id, fromGalaxy: 1, fromSystem: 1, fromPosition: 1, toGalaxy: 1, toSystem: 1, toPosition: 2, missiles: 3, startTime: new Date(), arrivalTime: new Date() },
    });
    await db.expeditionReport.create({ data: { userId: alice.id, galaxy: 1, system: 1, outcome: 'nothing', details: {}, ships: {} } });
    await db.combatReport.create({
      data: { attackerId: alice.id, defenderId: bob.id, attackerShips: {}, defenderShips: {}, defenderDefs: {}, attackerLosses: {}, defenderLosses: {}, result: 'draw', timeline: [], loot: {}, debris: {}, galaxy: 1, system: 1, position: 2 },
    });
    await db.spyReport.create({ data: { attackerId: alice.id, defenderId: bob.id, galaxy: 1, system: 1, position: 2, planetName: 'x', probes: 1, infoLevel: 1, data: {} } });
    await db.debrisField.create({ data: { galaxy: 1, system: 1, position: 2 } });
    await db.message.create({ data: { fromId: alice.id, toId: bob.id, subject: 'Salut', body: 'Salut Bob' } });

    const alliance = await db.alliance.create({ data: { tag: 'RZ', name: 'Alliance RZ', founderId: alice.id } });
    ids.alliance = alliance.id;
    await db.allianceMember.createMany({
      data: [
        { allianceId: alliance.id, userId: alice.id, rank: 'founder' },
        { allianceId: alliance.id, userId: bob.id, rank: 'member' },
      ],
    });

    const offer = await db.marketOffer.create({
      data: { sellerId: alice.id, giveResource: 'metal', wantResource: 'crystal', amount: 100, remaining: 100, rate: 1.5, expiresAt: new Date(Date.now() + 3600_000) },
    });
    await db.marketTrade.create({
      data: { offerId: offer.id, buyerId: bob.id, sellerId: alice.id, giveResource: 'metal', wantResource: 'crystal', amount: 10, rate: 1.5, payment: 15, tax: 1 },
    });
    await db.npcTrade.create({ data: { userId: alice.id, planetId: pa.id, kind: 'EXCHANGE', value: 10 } });
    const boss = await db.galacticBoss.create({ data: { nameId: 1, galaxy: 1, system: 1, ships: {}, maxShips: {}, status: 'ALIVE' } });
    await db.bossDamage.create({ data: { bossId: boss.id, userId: alice.id, planetId: pb.id, damage: 5, battles: 1 } });
    await db.questClaim.create({ data: { userId: alice.id, questId: 'daily_build', periodKey: '2026-11-03' } });
    await db.achievementUnlock.create({ data: { userId: alice.id, achievementId: 'first_planet' } });
    await db.officer.create({ data: { userId: alice.id, type: 'admiral' } });
    await db.worldEvent.create({ data: { startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) } });

    // Conservés
    await db.gameConfig.upsert({ where: { key: 'planetSize' }, update: { value: '120' }, create: { key: 'planetSize', value: '120' } });
    await db.gameConfig.upsert({ where: { key: 'setup.completedAt' }, update: { value: 'fait' }, create: { key: 'setup.completedAt', value: 'fait' } });
    await db.adminAuditLog.create({ data: { userId: admin.id, action: 'test.audit', changes: {} } });
    await db.supportReport.create({ data: { userId: alice.id, kind: 'bug', subject: 'Un bug', body: 'Description du bug' } });
    const session = await db.session.create({ data: { userId: alice.id, refreshHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) } });
    sessionId = session.id;
    await db.accountIp.create({ data: { userId: alice.id, ip: '10.0.0.1' } as never });
  };

  const counts = async () => ({
    users: await db.user.count(),
    planets: await db.planet.count(),
    fleets: await db.fleet.count(),
    messages: await db.message.count(),
    alliances: await db.alliance.count(),
    reports: (await db.combatReport.count()) + (await db.spyReport.count()),
    offers: await db.marketOffer.count(),
  });

  beforeAll(async () => {
    isolated = await useIsolatedSchema('universe_reset');
    db = new PrismaClient({ datasources: { db: { url: isolated.url } } });
    await seed();
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    await isolated?.drop();
  });

  describe('garde-fous : rien ne change', () => {
    it('refuse si l\'API répond encore', async () => {
      const before = await counts();
      const { io, err } = makeIo(['RESET']);
      expect(await run(deps(io), [], hooks({ apiIsRunning: async () => true }))).toBe(1);
      expect(err.join('\n')).toMatch(/arrêtez le jeu/);
      expect(await counts()).toEqual(before);
    });

    it('sans la confirmation RESET', async () => {
      const before = await counts();
      let backups = 0;
      const { io, err } = makeIo(['non']);
      expect(await run(deps(io), [], hooks({ backup: async () => { backups += 1; return 'x'; } }))).toBe(1);
      expect(err.join('\n')).toMatch(/Annulé/);
      expect(backups).toBe(0);
      expect(await counts()).toEqual(before);
    });

    it('--dry-run : affiche ce qui serait effacé, sans sauvegarde ni changement', async () => {
      const before = await counts();
      let backups = 0;
      const { io, out } = makeIo();
      expect(await run(deps(io), ['--dry-run'], hooks({ backup: async () => { backups += 1; return 'x'; } }))).toBe(0);
      expect(out.join('\n')).toContain('Simulation');
      expect(out.join('\n')).toMatch(/flottes : 1/);
      expect(out.join('\n')).toMatch(/Comptes conservés : 3/);
      expect(backups).toBe(0);
      expect(await counts()).toEqual(before);
    });

    it('sauvegarde en échec : rien n\'est modifié', async () => {
      const before = await counts();
      const { io } = makeIo(['RESET']);
      await expect(
        run(deps(io), [], hooks({ backup: async () => { throw new Error('disque plein'); } })),
      ).rejects.toThrow('disque plein');
      expect(await counts()).toEqual(before);
      expect(await db.gameConfig.findUnique({ where: { key: UNIVERSE_RESET_KEY } })).toBeNull();
    });

    it('échec pendant l\'opération : la transaction annule tout', async () => {
      const before = await counts();
      let calls = 0;
      const { io } = makeIo(['RESET']);
      await expect(
        run(deps(io), [], hooks({
          starterPlanet: (async (tx: never, userId: string, fieldsMax: number) => {
            calls += 1;
            if (calls === 2) throw new Error('panne injectée');
            return createStarterPlanetWithRetry(tx, userId, fieldsMax);
          }) as UniverseResetHooks['starterPlanet'],
        })),
      ).rejects.toThrow('panne injectée');
      expect(await counts()).toEqual(before);
      expect((await db.user.findUniqueOrThrow({ where: { id: ids.alice } })).points).toBe(1234);
      expect(await db.planet.findUnique({ where: { id: oldAlicePlanetId } })).not.toBeNull();
    });
  });

  describe('remise à zéro', () => {
    it('efface les données de jeu, garde les comptes, donne une planète neuve à chacun', async () => {
      const { io, out, err } = makeIo(['RESET']);
      const code = await run(deps(io), [], hooks());
      expect(err).toEqual([]);
      expect(code).toBe(0);
      expect(out.join('\n')).toContain('/backups/xnova_backup_test.sql.gz');

      // Plus aucune donnée de jeu
      expect(await db.fleet.count()).toBe(0);
      expect(await db.attackGroup.count()).toBe(0);
      expect(await db.missileStrike.count()).toBe(0);
      expect(await db.expeditionReport.count()).toBe(0);
      expect(await db.combatReport.count()).toBe(0);
      expect(await db.spyReport.count()).toBe(0);
      expect(await db.debrisField.count()).toBe(0);
      expect(await db.message.count()).toBe(0);
      expect(await db.alliance.count()).toBe(0);
      expect(await db.allianceMember.count()).toBe(0);
      expect(await db.marketOffer.count()).toBe(0);
      expect(await db.marketTrade.count()).toBe(0);
      expect(await db.npcTrade.count()).toBe(0);
      expect(await db.galacticBoss.count()).toBe(0);
      expect(await db.bossDamage.count()).toBe(0);
      expect(await db.questClaim.count()).toBe(0);
      expect(await db.achievementUnlock.count()).toBe(0);
      expect(await db.officer.count()).toBe(0);
      expect(await db.fleetCommander.count()).toBe(0);
      expect(await db.technology.count()).toBe(0);
      expect(await db.researchQueue.count()).toBe(0);
      expect(await db.worldEvent.count()).toBe(0);
      expect(await db.buildQueue.count()).toBe(0);
      expect(await db.ship.count()).toBe(0);
      expect(await db.defense.count()).toBe(0);

      // Comptes gardés, points et rangs remis à zéro
      const alice = await db.user.findUniqueOrThrow({ where: { id: ids.alice } });
      expect(alice).toMatchObject({ username: 'rz_alice', email: 'rz_alice@example.test', password: 'hash-rz_alice', role: 'PLAYER', locale: 'de', termsVersion: '2026-11-03.2', points: 0, rank: 0 });
      expect((await db.user.findUniqueOrThrow({ where: { id: ids.admin } })).role).toBe('SUPER_ADMIN');

      // Une seule planète neuve par compte, aux ressources de départ et à la taille réglée
      for (const userId of [ids.admin, ids.alice, ids.bob]) {
        const planets = await db.planet.findMany({ where: { userId } });
        expect(planets).toHaveLength(1);
        expect(planets[0]).toMatchObject({
          name: 'Planète Mère',
          isMoon: false,
          metal: GAME_CONSTANTS.STARTING_METAL,
          crystal: GAME_CONSTANTS.STARTING_CRYSTAL,
          deuterium: GAME_CONSTANTS.STARTING_DEUTERIUM,
          fieldsMax: 120,
          fieldsUsed: 0,
        });
      }
      expect(await db.planet.findUnique({ where: { id: oldAlicePlanetId } })).toBeNull();

      // Fond de galaxie, réglages, audit et support conservés
      expect(await db.planet.findUnique({ where: { id: abandonedPlanetId } })).not.toBeNull();
      expect(await db.user.findUnique({ where: { id: ids.abandoned } })).not.toBeNull();
      expect((await db.gameConfig.findUnique({ where: { key: 'setup.completedAt' } }))?.value).toBe('fait');
      expect(await db.adminAuditLog.count()).toBe(1);
      expect(await db.supportReport.count()).toBe(1);
      expect(await db.accountIp.count()).toBe(1);

      // Sessions révoquées
      expect((await db.session.findUniqueOrThrow({ where: { id: sessionId } })).revokedAt).toBeInstanceOf(Date);

      // Trace de l'opération
      const trace = JSON.parse((await db.gameConfig.findUniqueOrThrow({ where: { key: UNIVERSE_RESET_KEY } })).value);
      expect(trace).toMatchObject({ accounts: 3, backup: '/backups/xnova_backup_test.sql.gz' });
    });

    it('relancée : même résultat, toujours une planète par compte', async () => {
      const { io } = makeIo();
      expect(await run(deps(io), ['--yes'], hooks())).toBe(0);
      for (const userId of [ids.admin, ids.alice, ids.bob]) {
        expect(await db.planet.count({ where: { userId } })).toBe(1);
      }
    });
  });
});
