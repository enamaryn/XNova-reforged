import {
  ACHIEVEMENTS,
  QUEST_CATALOG,
  QUESTS_PER_PERIOD,
  activeQuests,
  periodEnd,
  periodKey,
  periodStart,
  questRewardMultiplier,
  scaledReward,
} from '@xnova/game-config';

const at = (iso: string) => new Date(`${iso}Z`);

describe('quêtes : périodes', () => {
  it('le jour commence à minuit UTC et finit au suivant', () => {
    const date = at('2026-10-13T17:45:10');
    expect(periodStart('daily', date).toISOString()).toBe('2026-10-13T00:00:00.000Z');
    expect(periodEnd('daily', date).toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(periodKey('daily', date)).toBe('2026-10-13');
    // la veille à 23 h 59 : autre jour
    expect(periodKey('daily', at('2026-10-12T23:59:59'))).toBe('2026-10-12');
  });

  it('la semaine va du lundi au dimanche (UTC)', () => {
    expect(periodStart('weekly', at('2026-10-12T00:00:00')).toISOString()).toBe('2026-10-12T00:00:00.000Z'); // lundi
    expect(periodStart('weekly', at('2026-10-18T23:59:59')).toISOString()).toBe('2026-10-12T00:00:00.000Z'); // dimanche
    expect(periodStart('weekly', at('2026-10-19T00:00:00')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(periodEnd('weekly', at('2026-10-14T10:00:00')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(periodKey('weekly', at('2026-10-13T12:00:00'))).toBe('2026-W42');
    expect(periodKey('weekly', at('2026-10-18T23:59:59'))).toBe('2026-W42');
    expect(periodKey('weekly', at('2026-10-19T00:00:00'))).toBe('2026-W43');
  });

  it("les semaines ISO franchissent correctement le changement d'année", () => {
    expect(periodKey('weekly', at('2026-01-01T12:00:00'))).toBe('2026-W01');
    expect(periodKey('weekly', at('2026-12-31T12:00:00'))).toBe('2026-W53');
    expect(periodKey('weekly', at('2027-01-01T12:00:00'))).toBe('2026-W53');
    expect(periodKey('weekly', at('2027-01-04T12:00:00'))).toBe('2027-W01');
  });
});

describe('quêtes : tirage et récompenses', () => {
  it('trois journalières et deux hebdomadaires, toujours différentes entre elles', () => {
    for (let day = 0; day < 60; day += 1) {
      const date = new Date(Date.UTC(2026, 9, 1 + day));
      const daily = activeQuests('daily', periodKey('daily', date));
      const weekly = activeQuests('weekly', periodKey('weekly', date));
      expect(daily).toHaveLength(QUESTS_PER_PERIOD.daily);
      expect(weekly).toHaveLength(QUESTS_PER_PERIOD.weekly);
      expect(new Set(daily.map((q) => q.id)).size).toBe(daily.length);
      expect(daily.every((q) => q.period === 'daily')).toBe(true);
      expect(weekly.every((q) => q.period === 'weekly')).toBe(true);
    }
  });

  it('le tirage est stable pour une même période et varie d’un jour à l’autre', () => {
    const key = '2026-10-13';
    expect(activeQuests('daily', key).map((q) => q.id)).toEqual(activeQuests('daily', key).map((q) => q.id));
    const seen = new Set<string>();
    for (let day = 0; day < 40; day += 1) {
      seen.add(activeQuests('daily', periodKey('daily', new Date(Date.UTC(2026, 9, 1 + day)))).map((q) => q.id).join());
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('chaque quête du catalogue apparaît au moins une fois sur une longue période', () => {
    const shown = new Set<string>();
    for (let day = 0; day < 400; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day));
      for (const q of activeQuests('daily', periodKey('daily', date))) shown.add(q.id);
      for (const q of activeQuests('weekly', periodKey('weekly', date))) shown.add(q.id);
    }
    expect(shown.size).toBe(QUEST_CATALOG.length);
  });

  it('le catalogue est cohérent : cibles positives, récompense non vide, identifiants uniques', () => {
    expect(new Set(QUEST_CATALOG.map((q) => q.id)).size).toBe(QUEST_CATALOG.length);
    for (const q of QUEST_CATALOG) {
      expect(q.target).toBeGreaterThan(0);
      expect(q.reward.metal + q.reward.crystal + q.reward.deuterium).toBeGreaterThan(0);
    }
  });

  it('la récompense suit le niveau de commandant (+10 % par niveau, plafond ×6)', () => {
    expect(questRewardMultiplier(1)).toBe(1);
    expect(questRewardMultiplier(11)).toBe(2);
    expect(questRewardMultiplier(51)).toBe(6);
    expect(questRewardMultiplier(100)).toBe(6);
    expect(questRewardMultiplier(0)).toBe(1);
    expect(questRewardMultiplier(Number.NaN)).toBe(1);
    expect(scaledReward({ metal: 20_000, crystal: 0, deuterium: 5 }, 1.5)).toEqual({ metal: 30_000, crystal: 0, deuterium: 7 });
  });
});

describe('succès : catalogue', () => {
  it('identifiants uniques, cibles positives, plusieurs catégories', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((a) => a.target > 0)).toBe(true);
    expect(new Set(ACHIEVEMENTS.map((a) => a.category)).size).toBe(6);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it("les paliers d'un même compteur sont croissants", () => {
    const byMetric = new Map<string, number[]>();
    for (const a of ACHIEVEMENTS) byMetric.set(a.metric, [...(byMetric.get(a.metric) ?? []), a.target]);
    for (const targets of byMetric.values()) expect([...targets].sort((x, y) => x - y)).toEqual(targets);
  });
});
