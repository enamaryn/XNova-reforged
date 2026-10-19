import { apiClient } from "./client";

export interface QuestReward {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface QuestRow {
  id: string;
  metric: string;
  target: number;
  progress: number;
  reward: QuestReward;
  claimed: boolean;
  claimable: boolean;
}

export interface QuestPeriodView {
  periodKey: string;
  resetsAt: string;
  quests: QuestRow[];
}

/** Quête terminée pendant une période passée et jamais réclamée : encore réclamable jusqu'à `expiresAt`. */
export interface PendingQuest {
  id: string;
  period: "daily" | "weekly";
  periodKey: string;
  metric: string;
  target: number;
  reward: QuestReward;
  expiresAt: string;
}

export interface QuestsOverview {
  rewardMultiplier: number;
  commanderLevel: number;
  daily: QuestPeriodView;
  weekly: QuestPeriodView;
  pending: PendingQuest[];
}

export interface AchievementRow {
  id: string;
  category: string;
  metric: string;
  target: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AchievementsOverview {
  total: number;
  unlocked: number;
  percent: number;
  newlyUnlocked: string[];
  categories: { category: string; achievements: AchievementRow[] }[];
}

export const questsApi = {
  list: () => apiClient.get<QuestsOverview>("/quests"),
  claim: (questId: string, planetId: string, periodKey?: string) =>
    apiClient.post<{ questId: string; periodKey: string; reward: QuestReward }>(`/quests/${questId}/claim`, {
      planetId,
      ...(periodKey ? { periodKey } : {}),
    }),
  achievements: () => apiClient.get<AchievementsOverview>("/achievements"),
};
