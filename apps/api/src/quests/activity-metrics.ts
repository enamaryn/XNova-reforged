import { Prisma } from '@prisma/client';
import { MissionType, type AchievementMetric } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { ProgressionService } from '../progression/progression.service';

type Db = Pick<
  Prisma.TransactionClient,
  | 'buildQueue'
  | 'researchQueue'
  | 'shipQueue'
  | 'fleet'
  | 'combatReport'
  | 'spyReport'
  | 'expeditionReport'
  | 'planet'
  | 'allianceMember'
  | 'officer'
  | 'fleetCommander'
  | 'marketTrade'
  | 'missileStrike'
>;

/**
 * Compteurs d'activité d'un joueur, lus dans les lignes déjà enregistrées par le jeu. Avec `since`, seule
 * l'activité depuis cet instant compte (fenêtre d'une quête) ; sans, c'est le cumul à vie (succès).
 * Aucun compteur ne dépend d'un incrément à la main : rien ne peut être compté deux fois.
 */
export async function activityCount(
  db: Db,
  progression: ProgressionService,
  userId: string,
  metric: AchievementMetric,
  since?: Date,
): Promise<number> {
  const done = since ? { endTime: { gte: since } } : {};
  const created = since ? { createdAt: { gte: since } } : {};
  switch (metric) {
    case 'buildings':
      return db.buildQueue.count({ where: { completed: true, planet: { userId }, ...done } });
    case 'research':
      return db.researchQueue.count({ where: { completed: true, userId, ...done } });
    case 'units': {
      const sum = await db.shipQueue.aggregate({
        where: { completed: true, planet: { userId }, ...done },
        _sum: { amount: true },
      });
      return sum._sum.amount ?? 0;
    }
    case 'fleets':
      return db.fleet.count({ where: { userId, ...created } });
    case 'combatsWon':
      return db.combatReport.count({ where: { attackerId: userId, result: 'attacker_win', ...created } });
    case 'spy':
      return db.spyReport.count({ where: { attackerId: userId, ...created } });
    case 'expeditions':
      return db.expeditionReport.count({ where: { userId, ...created } });
    case 'commanderLevel':
      return (await progression.get(userId)).commanderLevel;
    case 'planets':
      return db.planet.count({ where: { userId, isMoon: false } });
    case 'moons':
      return db.planet.count({ where: { userId, isMoon: true } });
    case 'alliance':
      return db.allianceMember.count({ where: { userId } });
    case 'groupAttacks':
      return db.fleet.count({ where: { userId, mission: MissionType.ACS_ATTACK } });
    case 'officers':
      return db.officer.count({ where: { userId } });
    case 'commanders':
      return db.fleetCommander.count({ where: { userId } });
    case 'trades':
      return db.marketTrade.count({ where: { OR: [{ buyerId: userId }, { sellerId: userId }] } });
    case 'missiles':
      return db.missileStrike.count({ where: { userId } });
  }
}

export type ActivityDatabase = DatabaseService;
