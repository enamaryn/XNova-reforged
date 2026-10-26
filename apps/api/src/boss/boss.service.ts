import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BOSS_CONFIG_KEY,
  BOSS_DEFAULTS,
  BOSS_LIMITS,
  BOSS_NAME_COUNT,
  EXPEDITION_POSITION,
  GAME_CONSTANTS,
  SHIPS,
  bossHealthRatio,
  bossRespawnAt,
  fleetValue,
  parseBossConfig,
  readBossConfig,
  regenerateBossFleet,
  shipTotal,
  splitBossLoot,
  type BossConfig,
} from '@xnova/game-config';
import { simulateCombat } from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';

type Tx = Prisma.TransactionClient;
type Ships = Record<number, number>;

export interface BossEngagement {
  userId: string;
  /** Planète qui recevra la part de butin (origine de la flotte). */
  planetId: string;
  ships: Ships;
  source: 'ATTACK' | 'EXPEDITION';
  galaxy: number;
  system: number;
}

export interface BossEngagementResult {
  result: 'attacker_win' | 'defender_win' | 'draw';
  rounds: number;
  survivors: Ships;
  attackerLosses: Ships;
  bossLosses: Ships;
  damage: number;
  bossHealthAfter: number;
  killed: boolean;
  /** Part de butin du joueur si son combat a tué le boss. */
  loot: Record<'metal' | 'crystal' | 'deuterium', number> | null;
  battleId: string;
}

function readShips(raw: unknown): Ships {
  const result: Ships = {};
  for (const [id, amount] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const n = Math.floor(Number(amount));
    if (SHIPS[Number(id)] && Number.isFinite(n) && n > 0) result[Number(id)] = n;
  }
  return result;
}

@Injectable()
export class BossService {
  private readonly logger = new Logger(BossService.name);

  constructor(private readonly database: DatabaseService) {}

  /** Horloge et hasard du service (surchargés par les tests). */
  protected now(): Date {
    return new Date();
  }
  protected random(): number {
    return Math.random();
  }

  async config(): Promise<BossConfig> {
    const row = await this.database.gameConfig.findUnique({ where: { key: BOSS_CONFIG_KEY } });
    return readBossConfig(row?.value);
  }

  // ===== Cycle de vie =====

  /** Chaque minute : apparition (premier boss ou fin du délai) et régénération du boss vivant. */
  async tick(): Promise<void> {
    const config = await this.config();
    if (!config.enabled) return;
    const alive = await this.database.galacticBoss.findFirst({ where: { activeSlot: 1 } });
    if (alive) {
      await this.persistRegen(alive.id, config);
      return;
    }
    const last = await this.database.galacticBoss.findFirst({ orderBy: { diedAt: 'desc' }, where: { status: 'DEAD' } });
    if (last?.respawnAt && last.respawnAt.getTime() > this.now().getTime()) return;
    await this.spawn(config);
  }

  /** Fait apparaître un boss à une position profonde tirée au hasard (ou imposée). Ne crée rien si un boss vit déjà. */
  async spawn(config: BossConfig, place?: { galaxy: number; system: number }) {
    const galaxy = place?.galaxy ?? 1 + Math.floor(this.random() * GAME_CONSTANTS.MAX_GALAXIES);
    const system = place?.system ?? 1 + Math.floor(this.random() * GAME_CONSTANTS.MAX_SYSTEMS);
    const nameId = 1 + Math.floor(this.random() * BOSS_NAME_COUNT);
    try {
      return await this.database.galacticBoss.create({
        data: {
          nameId,
          galaxy: Math.min(Math.max(galaxy, 1), GAME_CONSTANTS.MAX_GALAXIES),
          system: Math.min(Math.max(system, 1), GAME_CONSTANTS.MAX_SYSTEMS),
          status: 'ALIVE',
          activeSlot: 1,
          ships: config.ships as unknown as Prisma.InputJsonValue,
          maxShips: config.ships as unknown as Prisma.InputJsonValue,
          spawnedAt: this.now(),
          lastRegenAt: this.now(),
        },
      });
    } catch (error) {
      // Un boss vit déjà (apparitions simultanées) : l'unicité de l'emplacement actif l'a refusée
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  private async persistRegen(bossId: string, config: BossConfig) {
    await this.database.$transaction(async (tx) => {
      await this.lockBoss(tx);
      const boss = await tx.galacticBoss.findUnique({ where: { id: bossId } });
      if (!boss || boss.activeSlot !== 1) return;
      const now = this.now();
      const hours = (now.getTime() - boss.lastRegenAt.getTime()) / 3_600_000;
      const ships = regenerateBossFleet(readShips(boss.ships), readShips(boss.maxShips), hours, config.regenPercentPerHour);
      await tx.galacticBoss.update({
        where: { id: boss.id },
        data: { ships: ships as unknown as Prisma.InputJsonValue, lastRegenAt: now },
      });
    });
  }

  private async lockBoss(tx: Tx) {
    await tx.$queryRaw`SELECT "id" FROM "GalacticBoss" WHERE "activeSlot" = 1 FOR UPDATE`;
  }

  /** Boss vivant à ces coordonnées (position 16), seulement si le boss est activé ; sinon null. */
  async aliveAt(galaxy: number, system: number, client: Pick<Tx, 'galacticBoss'> = this.database) {
    return client.galacticBoss.findFirst({ where: { activeSlot: 1, galaxy, system } });
  }

  /** Vérifie, avant l'envoi d'une attaque, qu'un boss vivant se trouve à cette position profonde. */
  async assertBossAt(galaxy: number, system: number, position: number) {
    const config = await this.config();
    const boss = config.enabled && position === EXPEDITION_POSITION ? await this.aliveAt(galaxy, system) : null;
    if (!boss) throw new BadRequestException('Aucun boss galactique a cette position');
    return boss;
  }

  // ===== Combat =====

  /**
   * Combat d'une flotte contre le boss, dans la transaction de l'appelant : verrou du boss, régénération, combat,
   * dégâts persistés, journal, et partage du butin si le boss meurt. Renvoie null s'il n'y a plus de boss vivant.
   */
  async engage(tx: Tx, engagement: BossEngagement, config?: BossConfig): Promise<BossEngagementResult | null> {
    const settings = config ?? (await this.config());
    if (!settings.enabled || shipTotal(engagement.ships) === 0) return null;
    await this.lockBoss(tx);
    const boss = await this.aliveAt(engagement.galaxy, engagement.system, tx);
    if (!boss) return null;

    const now = this.now();
    const max = readShips(boss.maxShips);
    const hours = (now.getTime() - boss.lastRegenAt.getTime()) / 3_600_000;
    const current = regenerateBossFleet(readShips(boss.ships), max, hours, settings.regenPercentPerHour);

    const techRows = await tx.technology.findMany({
      where: { userId: engagement.userId, techId: { in: [109, 110, 111] } },
      select: { techId: true, level: true },
    });
    const level = (id: number) => techRows.find((row) => row.techId === id)?.level ?? 0;

    const combat = simulateCombat({
      attackerShips: engagement.ships,
      defenderShips: current,
      attackerTech: { weapon: level(109), armor: level(110), shield: level(111) },
      defenderTech: settings.tech,
    });

    const remaining: Ships = {};
    for (const [id, count] of Object.entries(combat.defenderRemaining)) if (count > 0) remaining[Number(id)] = count;
    const bossLosses: Ships = {};
    for (const [id, count] of Object.entries(combat.defenderLosses)) if (count > 0) bossLosses[Number(id)] = count;
    const damage = fleetValue(bossLosses);
    const killed = shipTotal(remaining) === 0;
    const healthAfter = bossHealthRatio(remaining, max);

    await tx.bossDamage.upsert({
      where: { bossId_userId: { bossId: boss.id, userId: engagement.userId } },
      create: { bossId: boss.id, userId: engagement.userId, planetId: engagement.planetId, damage, battles: 1, lastAt: now },
      update: { planetId: engagement.planetId, damage: { increment: damage }, battles: { increment: 1 }, lastAt: now },
    });

    const attackerLosses: Ships = {};
    for (const [id, count] of Object.entries(combat.attackerLosses)) if (count > 0) attackerLosses[Number(id)] = count;
    const battle = await tx.bossBattle.create({
      data: {
        bossId: boss.id,
        userId: engagement.userId,
        source: engagement.source,
        galaxy: boss.galaxy,
        system: boss.system,
        result: combat.result,
        rounds: combat.rounds,
        attackerShips: engagement.ships as unknown as Prisma.InputJsonValue,
        attackerLosses: attackerLosses as unknown as Prisma.InputJsonValue,
        bossLosses: bossLosses as unknown as Prisma.InputJsonValue,
        damage,
        bossHealthAfter: healthAfter,
        killed,
        createdAt: now,
      },
    });

    let myLoot: BossEngagementResult['loot'] = null;
    if (killed) {
      await tx.galacticBoss.update({
        where: { id: boss.id },
        data: {
          status: 'DEAD',
          activeSlot: null,
          ships: {},
          lastRegenAt: now,
          diedAt: now,
          respawnAt: bossRespawnAt(now, settings.respawnDays),
          killedById: engagement.userId,
        },
      });
      myLoot = await this.shareLoot(tx, boss.id, boss.galaxy, boss.system, settings, engagement.userId, now);
    } else {
      await tx.galacticBoss.update({
        where: { id: boss.id },
        data: { ships: remaining as unknown as Prisma.InputJsonValue, lastRegenAt: now },
      });
    }

    return {
      result: combat.result,
      rounds: combat.rounds,
      survivors: combat.attackerRemaining,
      attackerLosses,
      bossLosses,
      damage,
      bossHealthAfter: healthAfter,
      killed,
      loot: myLoot,
      battleId: battle.id,
    };
  }

  /** Mort du boss : butin versé à la planète de chaque participant au prorata de ses dégâts. */
  private async shareLoot(tx: Tx, bossId: string, galaxy: number, system: number, config: BossConfig, killerId: string, now: Date) {
    const rows = await tx.bossDamage.findMany({ where: { bossId } });
    const shares = splitBossLoot(config.loot, rows.map((row) => ({ key: row.userId, damage: row.damage })));
    let killerShare: BossEngagementResult['loot'] = null;
    for (const row of rows) {
      const share = shares[row.userId];
      if (!share) continue;
      // Planète d'origine disparue : première planète du joueur
      const planet =
        (await tx.planet.findFirst({ where: { id: row.planetId, userId: row.userId }, select: { id: true } })) ??
        (await tx.planet.findFirst({ where: { userId: row.userId, isMoon: false }, orderBy: { createdAt: 'asc' }, select: { id: true } }));
      if (planet) {
        await tx.planet.update({
          where: { id: planet.id },
          data: { metal: { increment: share.metal }, crystal: { increment: share.crystal }, deuterium: { increment: share.deuterium } },
        });
      }
      await tx.bossBattle.create({
        data: { bossId, userId: row.userId, source: 'LOOT', galaxy, system, damage: row.damage, killed: row.userId === killerId, loot: share, createdAt: now },
      });
      if (row.userId === killerId) killerShare = share;
    }
    return killerShare;
  }

  /** Planète d'origine d'une flotte (reçoit la part de butin) ; à défaut, première planète du joueur. */
  async originPlanetId(
    tx: Tx,
    fleet: { userId: string; fromGalaxy: number; fromSystem: number; fromPosition: number; fromMoon: boolean },
  ): Promise<string | null> {
    const origin =
      (await tx.planet.findFirst({
        where: { userId: fleet.userId, galaxy: fleet.fromGalaxy, system: fleet.fromSystem, position: fleet.fromPosition, isMoon: fleet.fromMoon },
        select: { id: true },
      })) ?? (await tx.planet.findFirst({ where: { userId: fleet.userId, isMoon: false }, orderBy: { createdAt: 'asc' }, select: { id: true } }));
    return origin?.id ?? null;
  }

  /**
   * Arrivée d'une flotte en attaque (mission 1) en position 16 : combat contre le boss, survivants au retour.
   * Renvoie false si la flotte a déjà été prise en charge (une seule résolution par flotte).
   */
  async resolveAttackArrival(fleet: {
    id: string;
    userId: string;
    ships: unknown;
    cargo: unknown;
    fromGalaxy: number;
    fromSystem: number;
    fromPosition: number;
    fromMoon: boolean;
    toGalaxy: number;
    toSystem: number;
  }): Promise<boolean> {
    const config = await this.config();
    return this.database.$transaction(async (tx) => {
      const claimed = await tx.fleet.updateMany({ where: { id: fleet.id, status: 'traveling' }, data: { status: 'returning' } });
      if (claimed.count !== 1) return false;
      const originId = await this.originPlanetId(tx, fleet);
      const sent = readShips(fleet.ships);
      const outcome = originId
        ? await this.engage(tx, { userId: fleet.userId, planetId: originId, ships: sent, source: 'ATTACK', galaxy: fleet.toGalaxy, system: fleet.toSystem }, config)
        : null;
      // Plus de boss (mort ou retiré entre l'envoi et l'arrivée) : la flotte rentre intacte
      if (!outcome) return true;
      if (shipTotal(outcome.survivors) === 0) {
        await tx.fleet.update({ where: { id: fleet.id }, data: { status: 'completed', ships: {}, cargo: {}, returnTime: null } });
        return true;
      }
      // Cargaison réduite à proportion des vaisseaux perdus (elle ne peut pas dépasser ce que les survivants portent)
      const keep = shipTotal(outcome.survivors) / Math.max(1, shipTotal(sent));
      const cargo = (fleet.cargo ?? {}) as Record<string, unknown>;
      const scaled = Object.fromEntries(
        ['metal', 'crystal', 'deuterium'].map((resource) => [resource, Math.floor((Number(cargo[resource]) || 0) * keep)]),
      );
      await tx.fleet.update({ where: { id: fleet.id }, data: { ships: outcome.survivors as unknown as Prisma.InputJsonValue, cargo: scaled } });
      return true;
    });
  }

  // ===== Lecture joueur =====

  /** État public : boss vivant (position, santé, régénération) ou prochaine apparition, et ma participation. */
  async state(userId: string) {
    const config = await this.config();
    const now = this.now();
    const alive = await this.database.galacticBoss.findFirst({ where: { activeSlot: 1 } });
    let boss: Record<string, unknown> | null = null;
    if (config.enabled && alive) {
      const max = readShips(alive.maxShips);
      const hours = (now.getTime() - alive.lastRegenAt.getTime()) / 3_600_000;
      const current = regenerateBossFleet(readShips(alive.ships), max, hours, config.regenPercentPerHour);
      const [top, mine] = await Promise.all([
        this.database.bossDamage.findMany({ where: { bossId: alive.id }, orderBy: { damage: 'desc' }, take: 10 }),
        this.database.bossDamage.findUnique({ where: { bossId_userId: { bossId: alive.id, userId } } }),
      ]);
      const users = await this.database.user.findMany({
        where: { id: { in: top.map((row) => row.userId) } },
        select: { id: true, username: true },
      });
      boss = {
        nameId: alive.nameId,
        galaxy: alive.galaxy,
        system: alive.system,
        position: EXPEDITION_POSITION,
        spawnedAt: alive.spawnedAt,
        health: bossHealthRatio(current, max),
        ships: current,
        maxShips: max,
        top: top.map((row) => ({ username: users.find((u) => u.id === row.userId)?.username ?? '?', damage: row.damage, battles: row.battles })),
        mine: mine ? { damage: mine.damage, battles: mine.battles } : null,
      };
    }
    const last = await this.database.galacticBoss.findFirst({ where: { status: 'DEAD' }, orderBy: { diedAt: 'desc' } });
    const battles = await this.database.bossBattle.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 });
    return {
      enabled: config.enabled,
      aggroChance: config.aggroChance,
      regenPercentPerHour: config.regenPercentPerHour,
      respawnDays: config.respawnDays,
      loot: config.loot,
      boss,
      nextSpawn: !alive && config.enabled ? last?.respawnAt ?? now : null,
      lastDeath: last ? { diedAt: last.diedAt, killedBy: last.killedById } : null,
      battles: battles.map((b) => ({
        id: b.id,
        source: b.source,
        galaxy: b.galaxy,
        system: b.system,
        result: b.result,
        rounds: b.rounds,
        attackerLosses: b.attackerLosses,
        bossLosses: b.bossLosses,
        damage: b.damage,
        bossHealthAfter: b.bossHealthAfter,
        killed: b.killed,
        loot: b.loot,
        createdAt: b.createdAt,
      })),
    };
  }

  // ===== Console d'administration =====

  async adminOverview() {
    const config = await this.config();
    const [alive, history] = await Promise.all([
      this.database.galacticBoss.findFirst({ where: { activeSlot: 1 } }),
      this.database.galacticBoss.findMany({ where: { status: 'DEAD' }, orderBy: { diedAt: 'desc' }, take: 10 }),
    ]);
    const max = alive ? readShips(alive.maxShips) : null;
    return {
      config,
      defaults: BOSS_DEFAULTS,
      limits: BOSS_LIMITS,
      sellableShips: Object.values(SHIPS).filter((ship) => ship.id !== 212).map((ship) => ({ id: ship.id, name: ship.name })),
      boss: alive
        ? { id: alive.id, nameId: alive.nameId, galaxy: alive.galaxy, system: alive.system, spawnedAt: alive.spawnedAt, health: bossHealthRatio(readShips(alive.ships), max!), ships: readShips(alive.ships) }
        : null,
      history: history.map((b) => ({ id: b.id, nameId: b.nameId, galaxy: b.galaxy, system: b.system, diedAt: b.diedAt, respawnAt: b.respawnAt })),
      fleetValue: fleetValue(config.ships),
    };
  }

  async updateConfig(actorId: string, input: unknown) {
    const parsed = parseBossConfig(input);
    if (parsed.ok === false) throw new BadRequestException(parsed.errors.join(' ; '));
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.upsert({
        where: { key: BOSS_CONFIG_KEY },
        create: { key: BOSS_CONFIG_KEY, value: JSON.stringify(parsed.config) },
        update: { value: JSON.stringify(parsed.config) },
      }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'update_boss', changes: { before, after: parsed.config } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return this.adminOverview();
  }

  async resetConfig(actorId: string) {
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.deleteMany({ where: { key: BOSS_CONFIG_KEY } }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'reset_boss', changes: { before, after: BOSS_DEFAULTS } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return this.adminOverview();
  }

  /** Apparition immédiate (boss désactivé ou délai non écoulé compris), à un endroit tiré au hasard ou imposé. */
  async adminSpawn(actorId: string, place?: { galaxy?: number; system?: number }) {
    if (place && ((place.galaxy ?? 1) < 1 || (place.galaxy ?? 1) > GAME_CONSTANTS.MAX_GALAXIES || (place.system ?? 1) < 1 || (place.system ?? 1) > GAME_CONSTANTS.MAX_SYSTEMS)) {
      throw new BadRequestException('Coordonnees invalides');
    }
    const config = await this.config();
    const boss = await this.spawn(config, place?.galaxy && place?.system ? { galaxy: place.galaxy, system: place.system } : undefined);
    if (!boss) throw new BadRequestException('Un boss vit deja');
    await this.database.adminAuditLog.create({ data: { userId: actorId, action: 'spawn_boss', changes: { galaxy: boss.galaxy, system: boss.system } } });
    return this.adminOverview();
  }

  /** Retire le boss vivant sans butin ; il réapparaît après le délai habituel. */
  async adminDespawn(actorId: string) {
    const config = await this.config();
    const now = this.now();
    const done = await this.database.$transaction(async (tx) => {
      await this.lockBoss(tx);
      const boss = await tx.galacticBoss.findFirst({ where: { activeSlot: 1 } });
      if (!boss) return null;
      await tx.galacticBoss.update({
        where: { id: boss.id },
        data: { status: 'DEAD', activeSlot: null, ships: {}, diedAt: now, respawnAt: bossRespawnAt(now, config.respawnDays) },
      });
      await tx.adminAuditLog.create({ data: { userId: actorId, action: 'despawn_boss', changes: { galaxy: boss.galaxy, system: boss.system } } });
      return boss;
    });
    if (!done) throw new NotFoundException('Aucun boss vivant');
    return this.adminOverview();
  }
}
