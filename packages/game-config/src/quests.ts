// Quêtes journalières et hebdomadaires, et succès. Tout est dérivé de l'activité réelle du joueur (lignes déjà
// enregistrées par le jeu) : aucune action n'est comptée deux fois et rien ne s'incrémente à la main.

export type QuestPeriod = 'daily' | 'weekly';

/** Compteurs d'activité mesurés sur la période d'une quête. */
export type QuestMetric = 'buildings' | 'research' | 'units' | 'fleets' | 'combatsWon' | 'spy' | 'expeditions';

export interface QuestReward {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface QuestDefinition {
  id: string;
  period: QuestPeriod;
  metric: QuestMetric;
  target: number;
  /** Récompense de base : multipliée par `questRewardMultiplier` selon le niveau de commandant du joueur. */
  reward: QuestReward;
}

const quest = (
  id: string,
  period: QuestPeriod,
  metric: QuestMetric,
  target: number,
  reward: Partial<QuestReward>,
): QuestDefinition => ({ id, period, metric, target, reward: { metal: 0, crystal: 0, deuterium: 0, ...reward } });

export const QUEST_CATALOG: readonly QuestDefinition[] = [
  // Journalières : 3 tirées chaque jour parmi ces 8
  quest('daily_build_3', 'daily', 'buildings', 3, { metal: 20_000 }),
  quest('daily_build_5', 'daily', 'buildings', 5, { metal: 30_000, crystal: 10_000 }),
  quest('daily_research_1', 'daily', 'research', 1, { crystal: 15_000 }),
  quest('daily_units_50', 'daily', 'units', 50, { deuterium: 8_000 }),
  quest('daily_fleets_2', 'daily', 'fleets', 2, { deuterium: 6_000 }),
  quest('daily_combat_1', 'daily', 'combatsWon', 1, { metal: 25_000 }),
  quest('daily_spy_3', 'daily', 'spy', 3, { crystal: 12_000 }),
  quest('daily_expedition_1', 'daily', 'expeditions', 1, { deuterium: 10_000 }),
  // Hebdomadaires : 2 tirées chaque semaine parmi ces 5
  quest('weekly_build_25', 'weekly', 'buildings', 25, { metal: 150_000, crystal: 75_000 }),
  quest('weekly_combat_5', 'weekly', 'combatsWon', 5, { metal: 100_000, deuterium: 60_000 }),
  quest('weekly_research_5', 'weekly', 'research', 5, { crystal: 120_000 }),
  quest('weekly_fleets_15', 'weekly', 'fleets', 15, { deuterium: 50_000 }),
  quest('weekly_expedition_5', 'weekly', 'expeditions', 5, { crystal: 50_000, deuterium: 80_000 }),
];

export const QUESTS_PER_PERIOD: Record<QuestPeriod, number> = { daily: 3, weekly: 2 };

export function questById(id: string): QuestDefinition | undefined {
  return QUEST_CATALOG.find((q) => q.id === id);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Début (UTC) de la période qui contient `date` : minuit, ou lundi minuit pour la semaine. */
export function periodStart(period: QuestPeriod, date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (period === 'weekly') {
    const sinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - sinceMonday);
  }
  return start;
}

/** Instant de la remise à zéro suivante. */
export function periodEnd(period: QuestPeriod, date: Date): Date {
  const end = periodStart(period, date);
  end.setUTCDate(end.getUTCDate() + (period === 'weekly' ? 7 : 1));
  return end;
}

/** Clé de période : « 2026-10-13 » (jour) ou « 2026-W42 » (semaine ISO, lundi → dimanche). */
export function periodKey(period: QuestPeriod, date: Date): string {
  const start = periodStart(period, date);
  if (period === 'daily') return `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`;
  // Semaine ISO : celle du jeudi de la semaine donne l'année et le numéro
  const thursday = new Date(start);
  thursday.setUTCDate(start.getUTCDate() + 3);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / 86_400_000 / 7) + 1;
  return `${thursday.getUTCFullYear()}-W${pad(week)}`;
}

/** Hachage FNV-1a 32 bits : tirage stable et identique pour tous les joueurs. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Quêtes actives pour une période (même tirage pour tous), dans un ordre stable. */
/** Nombre de périodes passées pendant lesquelles une quête terminée mais non réclamée reste réclamable. */
export const QUEST_CLAIM_WINDOW: Record<QuestPeriod, number> = { daily: 30, weekly: 12 };

export interface PastPeriod {
  period: QuestPeriod;
  key: string;
  start: Date;
  /** Exclusive : début de la période suivante. */
  end: Date;
  /** Instant où ses quêtes terminées cessent d'être réclamables. */
  expiresAt: Date;
}

/** Type de période d'une clé (« 2026-10-13 » : journalière ; « 2026-W42 » : hebdomadaire), ou null si elle est invalide. */
export function periodOfKey(key: string): QuestPeriod | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'daily';
  if (/^\d{4}-W\d{2}$/.test(key)) return 'weekly';
  return null;
}

/**
 * Périodes passées dont les quêtes terminées sont encore réclamables, de la plus récente à la plus ancienne :
 * les QUEST_CLAIM_WINDOW dernières périodes, sans la période en cours ni celles terminées avant la création du compte.
 */
export function claimablePastPeriods(period: QuestPeriod, now: Date, accountCreatedAt?: Date): PastPeriod[] {
  const length = period === 'weekly' ? 7 : 1;
  const currentStart = periodStart(period, now);
  const list: PastPeriod[] = [];
  for (let index = 1; index <= QUEST_CLAIM_WINDOW[period]; index += 1) {
    const start = new Date(currentStart);
    start.setUTCDate(start.getUTCDate() - index * length);
    const end = periodEnd(period, start);
    if (accountCreatedAt && end.getTime() <= accountCreatedAt.getTime()) break;
    const expiresAt = new Date(currentStart);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + (QUEST_CLAIM_WINDOW[period] - index + 1) * length);
    list.push({ period, key: periodKey(period, start), start, end, expiresAt });
  }
  return list;
}

export function activeQuests(period: QuestPeriod, key: string): QuestDefinition[] {
  return QUEST_CATALOG.filter((q) => q.period === period)
    .map((q) => ({ q, order: hash(`${key}:${q.id}`) }))
    .sort((a, b) => a.order - b.order || a.q.id.localeCompare(b.q.id))
    .slice(0, QUESTS_PER_PERIOD[period])
    .map(({ q }) => q);
}

/** Les récompenses suivent le niveau de commandant (1 → ×1,0 ; +10 % par niveau ; plafond ×6). */
export function questRewardMultiplier(commanderLevel: number): number {
  return Math.min(6, 1 + 0.1 * (Math.max(1, Math.floor(commanderLevel || 1)) - 1));
}

export function scaledReward(reward: QuestReward, multiplier: number): QuestReward {
  return {
    metal: Math.floor(reward.metal * multiplier),
    crystal: Math.floor(reward.crystal * multiplier),
    deuterium: Math.floor(reward.deuterium * multiplier),
  };
}

// ---------------- Succès ----------------

export type AchievementCategory = 'progression' | 'build' | 'combat' | 'exploration' | 'social' | 'economy';

/** Compteurs à vie (les métriques de quête, sans fenêtre de temps, plus celles-ci). */
export type AchievementMetric =
  | QuestMetric
  | 'commanderLevel'
  | 'planets'
  | 'moons'
  | 'alliance'
  | 'groupAttacks'
  | 'officers'
  | 'commanders'
  | 'trades'
  | 'missiles';

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  target: number;
}

const ach = (
  category: AchievementCategory,
  metric: AchievementMetric,
  targets: readonly number[],
  prefix = metric as string,
): AchievementDefinition[] => targets.map((target) => ({ id: `${prefix}_${target}`, category, metric, target }));

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  ...ach('progression', 'commanderLevel', [5, 10, 25, 50]),
  ...ach('progression', 'planets', [2, 5, 9]),
  ...ach('build', 'buildings', [10, 100, 500]),
  ...ach('build', 'research', [5, 25, 100]),
  ...ach('build', 'units', [100, 10_000]),
  ...ach('combat', 'combatsWon', [1, 10, 100]),
  ...ach('combat', 'spy', [10, 100]),
  ...ach('combat', 'missiles', [1]),
  ...ach('combat', 'groupAttacks', [1]),
  ...ach('exploration', 'expeditions', [1, 10, 50]),
  ...ach('exploration', 'moons', [1]),
  ...ach('exploration', 'fleets', [10, 100]),
  ...ach('social', 'alliance', [1]),
  ...ach('economy', 'officers', [1, 5]),
  ...ach('economy', 'commanders', [1]),
  ...ach('economy', 'trades', [1, 25]),
];

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  'progression',
  'build',
  'combat',
  'exploration',
  'social',
  'economy',
];
