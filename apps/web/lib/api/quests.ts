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

export interface QuestsOverview {
  rewardMultiplier: number;
  commanderLevel: number;
  daily: QuestPeriodView;
  weekly: QuestPeriodView;
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
  claim: (questId: string, planetId: string) =>
    apiClient.post<{ questId: string; periodKey: string; reward: QuestReward }>(`/quests/${questId}/claim`, { planetId }),
  achievements: () => apiClient.get<AchievementsOverview>("/achievements"),
};
