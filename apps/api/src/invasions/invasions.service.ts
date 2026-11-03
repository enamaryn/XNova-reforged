import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EXPEDITION_POSITION,
  GAME_CONSTANTS,
  INVASION_CONFIG_KEY,
  INVASION_DEFAULTS,
  INVASION_LIMITS,
  INVASION_NAME_COUNT,
  SHIPS,
  bossHealthRatio,
  fleetValue,
  invasionDeadline,
  invasionExpired,
  nextAutoInvasionAt,
  parseInvasionConfig,
  readInvasionConfig,
  regenerateBossFleet,
  shipTotal,
  splitBossLoot,
  waveFleet,
  type InvasionConfig,
} from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { WorldEventsService } from '../world-events/world-events.service';
import { fightNpcFleet, readShips, settleNpcArrival, type ArrivingFleet, type Ships, type Tx } from '../boss/npc-combat';

type Loot = Record<'metal' | 'crystal' | 'deuterium', number>;

/** Nom d'événement du monde (traduit côté interface) du bonus d'une invasion repoussée. */
export const INVASION_REWARD_TEMPLATE = 'invasion_victory';

export interface InvasionEngagement {
  userId: string;
  /** Planète qui recevra la part de butin (origine de la flotte). */
  planetId: string;
  ships: Ships;
  galaxy: number;
  system: number;
}

export interface InvasionEngagementResult {
  result: 'attacker_win' | 'defender_win' | 'draw';
  rounds: number;
  survivors: Ships;
  attackerLosses: Ships;
  npcLosses: Ships;
  damage: number;
  waveIndex: number;
  waveHealthAfter: number;
  /** La vague a été détruite par ce combat. */
  cleared: boolean;
  /** L'invasion est repoussée (dernière vague détruite). */
  repelled: boolean;
  /** Part de butin du joueur versée par ce combat (vague détruite et, le cas échéant, invasion repoussée). */
  loot: Loot | null;
  battleId: string;
}

@Injectable()
export class InvasionService {
  private readonly logger = new Logger(InvasionService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly worldEvents: WorldEventsService,
  ) {}

  /** Horloge et hasard du service (surchargés par les tests). */
  protected now(): Date {
    return new Date();
  }
  protected random(): number {
    return Math.random();
  }

  async config(): Promise<InvasionConfig> {
    const row = await this.database.gameConfig.findUnique({ where: { key: INVASION_CONFIG_KEY } });
    return readInvasionConfig(row?.value);
  }

  // ===== Cycle de vie =====

  /**
   * Chaque minute : bonus à offrir, échéance dépassée (les aliens se retirent), régénération de la vague en cours,
   * lancement automatique (intervalle réglé, jamais par défaut).
   */
  async tick(): Promise<void> {
    await this.deliverRewards();
    const config = await this.config();
    if (!config.enabled) return;
    const now = this.now();
    const active = await this.database.invasion.findFirst({ where: { activeSlot: 1 } });
    if (active) {
      if (invasionExpired(active.endsAt, now)) await this.expire(active.id);
      else await this.persistRegen(active.id, config);
      return;
    }
    const last = await this.database.invasion.findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' }, select: { finishedAt: true } });
    const next = nextAutoInvasionAt(last?.finishedAt ?? null, config.autoIntervalDays);
    if (next && next.getTime() <= now.getTime()) await this.start(config, { auto: true });
  }

  /** Un seul verrou pour tout ce qui touche à l'invasion en cours (pas d'inversion d'ordre, donc pas d'interblocage). */
  private async lockInvasion(tx: Tx) {
    await tx.$queryRaw`SELECT "id" FROM "Invasion" WHERE "activeSlot" = 1 FOR UPDATE`;
  }

  /** Système au hasard dans la galaxie, hors du système où se trouve le boss galactique (un adversaire par position). */
  private async pickSystem(tx: Pick<Tx, 'galacticBoss'>, galaxy: number): Promise<number> {
    let system = 1 + Math.floor(this.random() * GAME_CONSTANTS.MAX_SYSTEMS);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const boss = await tx.galacticBoss.findFirst({ where: { activeSlot: 1, galaxy, system }, select: { id: true } });
      if (!boss) break;
      system = 1 + Math.floor(this.random() * GAME_CONSTANTS.MAX_SYSTEMS);
    }
    return system;
  }

  /** Lance une invasion (première vague comprise). Renvoie null si une invasion est déjà en cours. */
  async start(config: InvasionConfig, options: { galaxy?: number; auto?: boolean } = {}) {
    const now = this.now();
    const galaxy = Math.min(Math.max(options.galaxy ?? 1 + Math.floor(this.random() * GAME_CONSTANTS.MAX_GALAXIES), 1), GAME_CONSTANTS.MAX_GALAXIES);
    const nameId = 1 + Math.floor(this.random() * INVASION_NAME_COUNT);
    try {
      return await this.database.$transaction(async (tx) => {
        const invasion = await tx.invasion.create({
          data: {
            nameId,
            status: 'ACTIVE',
            activeSlot: 1,
            galaxy,
            totalWaves: config.waves,
            currentWave: 1,
            startedAt: now,
            endsAt: invasionDeadline(now, config.durationHours),
            auto: options.auto === true,
          },
        });
        const ships = waveFleet(config.waveShips, config.waveGrowth, 1);
        await tx.invasionWave.create({
          data: {
            invasionId: invasion.id,
            index: 1,
            system: await this.pickSystem(tx, galaxy),
            status: 'ACTIVE',
            activeSlot: 1,
            ships: ships as unknown as Prisma.InputJsonValue,
            maxShips: ships as unknown as Prisma.InputJsonValue,
            spawnedAt: now,
            lastRegenAt: now,
          },
        });
        return invasion;
      });
    } catch (error) {
      // Une invasion est déjà en cours (lancements simultanés) : l'unicité de l'emplacement actif l'a refusée
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  /** Échéance dépassée : les aliens se retirent, sans butin ni bonus. */
  private async expire(invasionId: string) {
    const now = this.now();
    await this.database.$transaction(async (tx) => {
      await this.lockInvasion(tx);
      const invasion = await tx.invasion.findUnique({ where: { id: invasionId } });
      if (!invasion || invasion.activeSlot !== 1) return;
      await tx.invasionWave.updateMany({ where: { invasionId, activeSlot: 1 }, data: { status: 'EXPIRED', activeSlot: null, ships: {}, clearedAt: now } });
      await tx.invasion.update({ where: { id: invasionId }, data: { status: 'FAILED', activeSlot: null, finishedAt: now } });
    });
  }

  private async persistRegen(invasionId: string, config: InvasionConfig) {
    await this.database.$transaction(async (tx) => {
      await this.lockInvasion(tx);
      const wave = await tx.invasionWave.findFirst({ where: { invasionId, activeSlot: 1 } });
      if (!wave) return;
      const now = this.now();
      const hours = (now.getTime() - wave.lastRegenAt.getTime()) / 3_600_000;
      const ships = regenerateBossFleet(readShips(wave.ships), readShips(wave.maxShips), hours, config.regenPercentPerHour);
      await tx.invasionWave.update({ where: { id: wave.id }, data: { ships: ships as unknown as Prisma.InputJsonValue, lastRegenAt: now } });
    });
  }

  /**
   * Offre le bonus de production d'une invasion repoussée (événement du monde), une seule fois par invasion : réessayé
   * à chaque passage tant qu'il n'a pas réussi. Hors transaction de combat (l'événement règle la production de tous).
   */
  async deliverRewards(): Promise<void> {
    const pending = await this.database.invasion.findMany({ where: { rewardPending: true }, select: { id: true, rewardProductionBonus: true, rewardDays: true } });
    for (const invasion of pending) {
      try {
        if (invasion.rewardProductionBonus > 0 && invasion.rewardDays > 0) {
          await this.worldEvents.launchReward({
            templateId: INVASION_REWARD_TEMPLATE,
            occurrenceKey: `invasion:${invasion.id}`,
            days: invasion.rewardDays,
            productionBonus: invasion.rewardProductionBonus,
            now: this.now(),
          });
        }
      } catch (error) {
        // Déjà lancé (reprise après coupure) : rien à refaire ; autre erreur : réessayé à la minute suivante
        if (!(error instanceof ConflictException)) {
          this.logger.error(`Bonus de l'invasion ${invasion.id} : ${(error as Error).message}`);
          continue;
        }
      }
      await this.database.invasion.update({ where: { id: invasion.id }, data: { rewardPending: false } });
    }
  }

  // ===== Front et combat =====

  /** Vague active à ces coordonnées (position 16), dans une invasion non expirée ; sinon null. */
  async frontAt(galaxy: number, system: number, client: Pick<Tx, 'invasionWave'> = this.database) {
    const wave = await client.invasionWave.findFirst({
      where: { activeSlot: 1, system, invasion: { galaxy, activeSlot: 1 } },
      include: { invasion: true },
    });
    if (!wave || invasionExpired(wave.invasion.endsAt, this.now())) return null;
    return wave;
  }

  /** Vérifie, avant l'envoi d'une attaque, qu'un front d'invasion se trouve à cette position profonde. */
  async assertFrontAt(galaxy: number, system: number, position: number) {
    const config = await this.config();
    const wave = config.enabled && position === EXPEDITION_POSITION ? await this.frontAt(galaxy, system) : null;
    if (!wave) throw new BadRequestException("Aucun boss ni front d'invasion a cette position");
    return wave;
  }

  /**
   * Combat d'une flotte contre la vague en cours, dans la transaction de l'appelant : verrou, régénération, combat,
   * dégâts persistés, journal ; vague détruite → butin de vague puis vague suivante ; dernière vague détruite →
   * invasion repoussée, butin final au prorata des dégâts de toute la campagne. Renvoie null s'il n'y a plus de front.
   */
  async engage(tx: Tx, engagement: InvasionEngagement, config?: InvasionConfig): Promise<InvasionEngagementResult | null> {
    const settings = config ?? (await this.config());
    if (!settings.enabled || shipTotal(engagement.ships) === 0) return null;
    await this.lockInvasion(tx);
    const wave = await this.frontAt(engagement.galaxy, engagement.system, tx);
    if (!wave) return null;
    const invasion = wave.invasion;

    const now = this.now();
    const max = readShips(wave.maxShips);
    const hours = (now.getTime() - wave.lastRegenAt.getTime()) / 3_600_000;
    const current = regenerateBossFleet(readShips(wave.ships), max, hours, settings.regenPercentPerHour);
    const fight = await fightNpcFleet(tx, { userId: engagement.userId, ships: engagement.ships, current, max, npcTech: settings.tech });

    await tx.invasionDamage.upsert({
      where: { waveId_userId: { waveId: wave.id, userId: engagement.userId } },
      create: { invasionId: invasion.id, waveId: wave.id, userId: engagement.userId, planetId: engagement.planetId, damage: fight.damage, battles: 1, lastAt: now },
      update: { planetId: engagement.planetId, damage: { increment: fight.damage }, battles: { increment: 1 }, lastAt: now },
    });
    const battle = await tx.invasionBattle.create({
      data: {
        invasionId: invasion.id,
        waveId: wave.id,
        waveIndex: wave.index,
        userId: engagement.userId,
        source: 'ATTACK',
        galaxy: invasion.galaxy,
        system: wave.system,
        result: fight.result,
        rounds: fight.rounds,
        attackerShips: engagement.ships as unknown as Prisma.InputJsonValue,
        attackerLosses: fight.attackerLosses as unknown as Prisma.InputJsonValue,
        npcLosses: fight.npcLosses as unknown as Prisma.InputJsonValue,
        damage: fight.damage,
        waveHealthAfter: fight.healthAfter,
        cleared: fight.killed,
        createdAt: now,
      },
    });

    let myLoot: Loot | null = null;
    let repelled = false;
    if (fight.killed) {
      await tx.invasionWave.update({
        where: { id: wave.id },
        data: { status: 'CLEARED', activeSlot: null, ships: {}, lastRegenAt: now, clearedAt: now },
      });
      const waveRows = await tx.invasionDamage.findMany({ where: { waveId: wave.id }, orderBy: { lastAt: 'asc' } });
      myLoot = await this.shareLoot(tx, invasion, wave, 'LOOT_WAVE', settings.waveLoot, waveRows, engagement.userId, now);

      if (wave.index < invasion.totalWaves) {
        const nextIndex = wave.index + 1;
        const ships = waveFleet(settings.waveShips, settings.waveGrowth, nextIndex);
        await tx.invasionWave.create({
          data: {
            invasionId: invasion.id,
            index: nextIndex,
            system: await this.pickSystem(tx, invasion.galaxy),
            status: 'ACTIVE',
            activeSlot: 1,
            ships: ships as unknown as Prisma.InputJsonValue,
            maxShips: ships as unknown as Prisma.InputJsonValue,
            spawnedAt: now,
            lastRegenAt: now,
          },
        });
        await tx.invasion.update({ where: { id: invasion.id }, data: { currentWave: nextIndex } });
      } else {
        repelled = true;
        await tx.invasion.update({
          where: { id: invasion.id },
          data: {
            status: 'REPELLED',
            activeSlot: null,
            finishedAt: now,
            rewardPending: settings.rewardProductionBonus > 0,
            rewardProductionBonus: settings.rewardProductionBonus,
            rewardDays: settings.rewardDays,
          },
        });
        const allRows = await tx.invasionDamage.findMany({ where: { invasionId: invasion.id }, orderBy: { lastAt: 'asc' } });
        // Un joueur, une part : dégâts additionnés sur toutes les vagues, butin versé sur sa dernière planète d'origine
        const perUser = new Map<string, { userId: string; planetId: string; damage: number }>();
        for (const row of allRows) {
          const known = perUser.get(row.userId);
          perUser.set(row.userId, { userId: row.userId, planetId: row.planetId, damage: (known?.damage ?? 0) + row.damage });
        }
        const finalShare = await this.shareLoot(tx, invasion, wave, 'LOOT_FINAL', settings.finalLoot, [...perUser.values()], engagement.userId, now);
        if (finalShare) {
          myLoot = {
            metal: (myLoot?.metal ?? 0) + finalShare.metal,
            crystal: (myLoot?.crystal ?? 0) + finalShare.crystal,
            deuterium: (myLoot?.deuterium ?? 0) + finalShare.deuterium,
          };
        }
      }
    } else {
      await tx.invasionWave.update({
        where: { id: wave.id },
        data: { ships: fight.remaining as unknown as Prisma.InputJsonValue, lastRegenAt: now },
      });
    }

    return {
      result: fight.result,
      rounds: fight.rounds,
      survivors: fight.survivors,
      attackerLosses: fight.attackerLosses,
      npcLosses: fight.npcLosses,
      damage: fight.damage,
      waveIndex: wave.index,
      waveHealthAfter: fight.healthAfter,
      cleared: fight.killed,
      repelled,
      loot: myLoot,
      battleId: battle.id,
    };
  }

  /** Verse un butin au prorata des dégâts ; renvoie la part du joueur `focusUserId`. */
  private async shareLoot(
    tx: Tx,
    invasion: { id: string; galaxy: number },
    wave: { id: string; index: number; system: number },
    source: 'LOOT_WAVE' | 'LOOT_FINAL',
    loot: Loot,
    rows: Array<{ userId: string; planetId: string; damage: number }>,
    focusUserId: string,
    now: Date,
  ): Promise<Loot | null> {
    const shares = splitBossLoot(loot, rows.map((row) => ({ key: row.userId, damage: row.damage })));
    let focus: Loot | null = null;
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
      await tx.invasionBattle.create({
        data: {
          invasionId: invasion.id,
          waveId: wave.id,
          waveIndex: wave.index,
          userId: row.userId,
          source,
          galaxy: invasion.galaxy,
          system: wave.system,
          damage: row.damage,
          cleared: row.userId === focusUserId,
          loot: share,
          createdAt: now,
        },
      });
      if (row.userId === focusUserId) focus = share;
    }
    return focus;
  }

  /**
   * Arrivée d'une flotte en attaque (mission 1) en position 16 contre un front d'invasion : combat, survivants au
   * retour. Renvoie false si la flotte a déjà été prise en charge. Le bonus éventuel est offert juste après.
   */
  async resolveAttackArrival(fleet: ArrivingFleet): Promise<boolean> {
    const config = await this.config();
    const processed = await settleNpcArrival(this.database, fleet, (tx, originId, sent) =>
      this.engage(tx, { userId: fleet.userId, planetId: originId, ships: sent, galaxy: fleet.toGalaxy, system: fleet.toSystem }, config),
    );
    if (processed) {
      try {
        await this.deliverRewards();
      } catch (error) {
        this.logger.error(`Bonus d'invasion : ${(error as Error).message}`);
      }
    }
    return processed;
  }

  // ===== Lecture joueur =====

  /** État public : invasion en cours (vague, santé, échéance, classement), dernière invasion terminée, mes combats. */
  async state(userId: string) {
    const config = await this.config();
    const now = this.now();
    const active = await this.database.invasion.findFirst({ where: { activeSlot: 1 } });
    let invasion: Record<string, unknown> | null = null;
    if (config.enabled && active) {
      const wave = await this.database.invasionWave.findFirst({ where: { invasionId: active.id, activeSlot: 1 } });
      const max = wave ? readShips(wave.maxShips) : {};
      const hours = wave ? (now.getTime() - wave.lastRegenAt.getTime()) / 3_600_000 : 0;
      const current = wave ? regenerateBossFleet(readShips(wave.ships), max, hours, config.regenPercentPerHour) : {};
      const totals = await this.database.invasionDamage.groupBy({ by: ['userId'], where: { invasionId: active.id }, _sum: { damage: true }, _count: { _all: true } });
      const ranked = [...totals].sort((a, b) => (b._sum.damage ?? 0) - (a._sum.damage ?? 0));
      const users = await this.database.user.findMany({
        where: { id: { in: ranked.slice(0, 10).map((row) => row.userId) } },
        select: { id: true, username: true },
      });
      const clearedWaves = await this.database.invasionWave.count({ where: { invasionId: active.id, status: 'CLEARED' } });
      const mine = totals.find((row) => row.userId === userId);
      invasion = {
        nameId: active.nameId,
        galaxy: active.galaxy,
        startedAt: active.startedAt,
        endsAt: active.endsAt,
        currentWave: active.currentWave,
        totalWaves: active.totalWaves,
        clearedWaves,
        wave: wave
          ? { index: wave.index, system: wave.system, position: EXPEDITION_POSITION, health: bossHealthRatio(current, max), ships: current, maxShips: max }
          : null,
        top: ranked.slice(0, 10).map((row) => ({ username: users.find((u) => u.id === row.userId)?.username ?? '?', damage: row._sum.damage ?? 0 })),
        participants: totals.length,
        mine: mine ? { damage: mine._sum.damage ?? 0 } : null,
      };
    }
    const last = await this.database.invasion.findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' } });
    const battles = await this.database.invasionBattle.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 });
    const nextAuto = nextAutoInvasionAt(last?.finishedAt ?? null, config.autoIntervalDays);
    return {
      enabled: config.enabled,
      waves: config.waves,
      durationHours: config.durationHours,
      regenPercentPerHour: config.regenPercentPerHour,
      waveLoot: config.waveLoot,
      finalLoot: config.finalLoot,
      rewardProductionBonus: config.rewardProductionBonus,
      rewardDays: config.rewardDays,
      invasion,
      nextAuto: config.enabled && !active && nextAuto ? (nextAuto.getTime() < now.getTime() ? now : nextAuto) : null,
      last: last ? { status: last.status, finishedAt: last.finishedAt, totalWaves: last.totalWaves, currentWave: last.currentWave } : null,
      battles: battles.map((b) => ({
        id: b.id,
        source: b.source,
        waveIndex: b.waveIndex,
        galaxy: b.galaxy,
        system: b.system,
        result: b.result,
        rounds: b.rounds,
        attackerLosses: b.attackerLosses,
        npcLosses: b.npcLosses,
        damage: b.damage,
        waveHealthAfter: b.waveHealthAfter,
        cleared: b.cleared,
        loot: b.loot,
        createdAt: b.createdAt,
      })),
    };
  }

  // ===== Console d'administration =====

  async adminOverview() {
    const config = await this.config();
    const [active, history] = await Promise.all([
      this.database.invasion.findFirst({ where: { activeSlot: 1 } }),
      this.database.invasion.findMany({ where: { status: { not: 'ACTIVE' } }, orderBy: { finishedAt: 'desc' }, take: 10 }),
    ]);
    let wave: { index: number; system: number; health: number } | null = null;
    if (active) {
      const row = await this.database.invasionWave.findFirst({ where: { invasionId: active.id, activeSlot: 1 } });
      if (row) wave = { index: row.index, system: row.system, health: bossHealthRatio(readShips(row.ships), readShips(row.maxShips)) };
    }
    return {
      config,
      defaults: INVASION_DEFAULTS,
      limits: INVASION_LIMITS,
      sellableShips: Object.values(SHIPS).filter((ship) => ship.id !== 212).map((ship) => ({ id: ship.id, name: ship.name })),
      waveValue: fleetValue(config.waveShips),
      invasion: active
        ? { id: active.id, nameId: active.nameId, galaxy: active.galaxy, startedAt: active.startedAt, endsAt: active.endsAt, currentWave: active.currentWave, totalWaves: active.totalWaves, wave }
        : null,
      history: history.map((i) => ({ id: i.id, nameId: i.nameId, galaxy: i.galaxy, status: i.status, startedAt: i.startedAt, finishedAt: i.finishedAt, currentWave: i.currentWave, totalWaves: i.totalWaves })),
    };
  }

  async updateConfig(actorId: string, input: unknown) {
    const parsed = parseInvasionConfig(input);
    if (parsed.ok === false) throw new BadRequestException(parsed.errors.join(' ; '));
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.upsert({
        where: { key: INVASION_CONFIG_KEY },
        create: { key: INVASION_CONFIG_KEY, value: JSON.stringify(parsed.config) },
        update: { value: JSON.stringify(parsed.config) },
      }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'update_invasion', changes: { before, after: parsed.config } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return this.adminOverview();
  }

  async resetConfig(actorId: string) {
    const before = await this.config();
    await this.database.$transaction([
      this.database.gameConfig.deleteMany({ where: { key: INVASION_CONFIG_KEY } }),
      this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'reset_invasion', changes: { before, after: INVASION_DEFAULTS } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return this.adminOverview();
  }

  /** Lancement immédiat (invasions désactivées comprises : l'administrateur peut tester avant d'activer). */
  async adminStart(actorId: string, place?: { galaxy?: number }) {
    if (place?.galaxy !== undefined && (place.galaxy < 1 || place.galaxy > GAME_CONSTANTS.MAX_GALAXIES)) {
      throw new BadRequestException('Galaxie invalide');
    }
    const config = await this.config();
    const invasion = await this.start(config, { galaxy: place?.galaxy });
    if (!invasion) throw new BadRequestException('Une invasion est deja en cours');
    await this.database.adminAuditLog.create({ data: { userId: actorId, action: 'start_invasion', changes: { galaxy: invasion.galaxy, waves: invasion.totalWaves } } });
    return this.adminOverview();
  }

  /** Annule l'invasion en cours : sans butin ni bonus. */
  async adminCancel(actorId: string) {
    const now = this.now();
    const done = await this.database.$transaction(async (tx) => {
      await this.lockInvasion(tx);
      const invasion = await tx.invasion.findFirst({ where: { activeSlot: 1 } });
      if (!invasion) return null;
      await tx.invasionWave.updateMany({ where: { invasionId: invasion.id, activeSlot: 1 }, data: { status: 'EXPIRED', activeSlot: null, ships: {}, clearedAt: now } });
      await tx.invasion.update({ where: { id: invasion.id }, data: { status: 'CANCELLED', activeSlot: null, finishedAt: now } });
      await tx.adminAuditLog.create({ data: { userId: actorId, action: 'cancel_invasion', changes: { galaxy: invasion.galaxy, currentWave: invasion.currentWave } } });
      return invasion;
    });
    if (!done) throw new NotFoundException('Aucune invasion en cours');
    return this.adminOverview();
  }
}
