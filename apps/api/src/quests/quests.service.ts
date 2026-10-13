import { ConflictException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  activeQuests,
  periodEnd,
  periodKey,
  periodStart,
  questRewardMultiplier,
  scaledReward,
  type QuestPeriod,
} from '@xnova/game-config';
import { lockPlanet } from '../common/atomic';
import { DatabaseService } from '../database/database.service';
import { ProgressionService } from '../progression/progression.service';
import { activityCount } from './activity-metrics';

const PERIODS: QuestPeriod[] = ['daily', 'weekly'];

@Injectable()
export class QuestsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly progression: ProgressionService,
  ) {}

  /** Horloge, isolée pour les tests. */
  protected now(): Date {
    return new Date();
  }

  /** Quêtes du jour et de la semaine : progression, récompense (selon le niveau de commandant) et état. */
  async list(userId: string) {
    const now = this.now();
    const level = (await this.progression.get(userId)).commanderLevel;
    const multiplier = questRewardMultiplier(level);
    const result: Record<string, unknown> = { rewardMultiplier: multiplier, commanderLevel: level };
    for (const period of PERIODS) {
      const key = periodKey(period, now);
      const since = periodStart(period, now);
      const claims = await this.database.questClaim.findMany({ where: { userId, periodKey: key }, select: { questId: true } });
      const claimed = new Set(claims.map((c) => c.questId));
      const quests = [];
      for (const quest of activeQuests(period, key)) {
        const progress = await activityCount(this.database, this.progression, userId, quest.metric, since);
        quests.push({
          id: quest.id,
          metric: quest.metric,
          target: quest.target,
          progress: Math.min(progress, quest.target),
          reward: scaledReward(quest.reward, multiplier),
          claimed: claimed.has(quest.id),
          claimable: progress >= quest.target && !claimed.has(quest.id),
        });
      }
      result[period] = { periodKey: key, resetsAt: periodEnd(period, now), quests };
    }
    return result;
  }

  /**
   * Réclame la récompense d'une quête terminée : une seule fois par période (l'unicité de `QuestClaim` tranche
   * les demandes simultanées), créditée sur la planète choisie.
   */
  async claim(userId: string, questId: string, planetId: string) {
    const now = this.now();
    let found: { period: QuestPeriod; key: string; quest: ReturnType<typeof activeQuests>[number] } | null = null;
    for (const period of PERIODS) {
      const key = periodKey(period, now);
      const quest = activeQuests(period, key).find((q) => q.id === questId);
      if (quest) found = { period, key, quest };
    }
    if (!found) throw new NotFoundException("Cette quete n'est pas active");
    const planet = await this.database.planet.findUnique({ where: { id: planetId }, select: { userId: true } });
    if (!planet || planet.userId !== userId) throw new NotFoundException('Planete introuvable');

    const level = (await this.progression.get(userId)).commanderLevel;
    const reward = scaledReward(found.quest.reward, questRewardMultiplier(level));
    const since = periodStart(found.period, now);

    try {
      await this.database.$transaction(async (tx) => {
        const progress = await activityCount(tx, this.progression, userId, found!.quest.metric, since);
        if (progress < found!.quest.target) {
          throw new BadRequestException(`Quete non terminee (${progress}/${found!.quest.target})`);
        }
        await tx.questClaim.create({ data: { userId, questId, periodKey: found!.key } });
        await lockPlanet(tx, planetId);
        await tx.planet.update({
          where: { id: planetId },
          data: {
            metal: { increment: reward.metal },
            crystal: { increment: reward.crystal },
            deuterium: { increment: reward.deuterium },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Recompense deja reclamee pour cette periode');
      }
      throw error;
    }
    return { questId, periodKey: found.key, reward };
  }

  /** Succès : progression de chacun, déblocage des nouveaux (enregistré une fois), pourcentage global. */
  async achievements(userId: string) {
    const metrics = new Map<string, number>();
    for (const achievement of ACHIEVEMENTS) {
      if (!metrics.has(achievement.metric)) {
        metrics.set(achievement.metric, await activityCount(this.database, this.progression, userId, achievement.metric));
      }
    }
    const reached = ACHIEVEMENTS.filter((a) => (metrics.get(a.metric) ?? 0) >= a.target);
    const before = await this.database.achievementUnlock.findMany({ where: { userId } });
    const known = new Set(before.map((u) => u.achievementId));
    const fresh = reached.filter((a) => !known.has(a.id));
    if (fresh.length > 0) {
      await this.database.achievementUnlock.createMany({
        data: fresh.map((a) => ({ userId, achievementId: a.id })),
        skipDuplicates: true,
      });
    }
    const unlocks = fresh.length > 0 ? await this.database.achievementUnlock.findMany({ where: { userId } }) : before;
    const unlockedAt = new Map(unlocks.map((u) => [u.achievementId, u.unlockedAt]));
    const list = ACHIEVEMENTS.map((a) => ({
      id: a.id,
      category: a.category,
      metric: a.metric,
      target: a.target,
      progress: Math.min(metrics.get(a.metric) ?? 0, a.target),
      unlocked: unlockedAt.has(a.id),
      unlockedAt: unlockedAt.get(a.id) ?? null,
    }));
    const unlockedCount = list.filter((a) => a.unlocked).length;
    return {
      total: list.length,
      unlocked: unlockedCount,
      percent: Math.floor((unlockedCount / list.length) * 100),
      newlyUnlocked: fresh.map((a) => a.id),
      categories: ACHIEVEMENT_CATEGORIES.map((category) => ({
        category,
        achievements: list.filter((a) => a.category === category),
      })),
    };
  }
}
