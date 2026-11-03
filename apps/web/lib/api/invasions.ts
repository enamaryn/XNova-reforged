import { apiClient } from "./client";

export type InvasionResource = "metal" | "crystal" | "deuterium";
export const INVASION_RESOURCES: InvasionResource[] = ["metal", "crystal", "deuterium"];
export type InvasionStatus = "ACTIVE" | "REPELLED" | "FAILED" | "CANCELLED";

export interface InvasionConfig {
  enabled: boolean;
  autoIntervalDays: number;
  waves: number;
  durationHours: number;
  waveShips: Record<string, number>;
  waveGrowth: number;
  tech: { weapon: number; shield: number; armor: number };
  regenPercentPerHour: number;
  waveLoot: Record<InvasionResource, number>;
  finalLoot: Record<InvasionResource, number>;
  rewardProductionBonus: number;
  rewardDays: number;
}

export interface InvasionBattleRow {
  id: string;
  source: "ATTACK" | "LOOT_WAVE" | "LOOT_FINAL";
  waveIndex: number;
  galaxy: number;
  system: number;
  result: "attacker_win" | "defender_win" | "draw" | null;
  rounds: number;
  attackerLosses: Record<string, number> | null;
  npcLosses: Record<string, number> | null;
  damage: number;
  waveHealthAfter: number | null;
  cleared: boolean;
  loot: Record<InvasionResource, number> | null;
  createdAt: string;
}

export interface InvasionState {
  enabled: boolean;
  waves: number;
  durationHours: number;
  regenPercentPerHour: number;
  waveLoot: Record<InvasionResource, number>;
  finalLoot: Record<InvasionResource, number>;
  rewardProductionBonus: number;
  rewardDays: number;
  invasion: {
    nameId: number;
    galaxy: number;
    startedAt: string;
    endsAt: string;
    currentWave: number;
    totalWaves: number;
    clearedWaves: number;
    wave: {
      index: number;
      system: number;
      position: number;
      health: number;
      ships: Record<string, number>;
      maxShips: Record<string, number>;
    } | null;
    top: { username: string; damage: number }[];
    participants: number;
    mine: { damage: number } | null;
  } | null;
  nextAuto: string | null;
  last: { status: InvasionStatus; finishedAt: string | null; totalWaves: number; currentWave: number } | null;
  battles: InvasionBattleRow[];
}

export interface InvasionAdmin {
  config: InvasionConfig;
  defaults: InvasionConfig;
  sellableShips: { id: number; name: string }[];
  waveValue: number;
  invasion: {
    id: string;
    nameId: number;
    galaxy: number;
    startedAt: string;
    endsAt: string;
    currentWave: number;
    totalWaves: number;
    wave: { index: number; system: number; health: number } | null;
  } | null;
  history: { id: string; nameId: number; galaxy: number; status: InvasionStatus; startedAt: string; finishedAt: string | null; currentWave: number; totalWaves: number }[];
}

export const invasionsApi = {
  state: () => apiClient.get<InvasionState>("/invasions"),
  admin: () => apiClient.get<InvasionAdmin>("/admin/invasions"),
  update: (config: InvasionConfig) => apiClient.put<InvasionAdmin>("/admin/invasions/config", config),
  reset: () => apiClient.delete<InvasionAdmin>("/admin/invasions/config"),
  start: (galaxy?: number) => apiClient.post<InvasionAdmin>("/admin/invasions/start", galaxy ? { galaxy } : {}),
  cancel: () => apiClient.post<InvasionAdmin>("/admin/invasions/cancel"),
};
