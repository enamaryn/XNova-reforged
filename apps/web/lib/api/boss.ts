import { apiClient } from "./client";

export type BossResource = "metal" | "crystal" | "deuterium";
export const BOSS_RESOURCES: BossResource[] = ["metal", "crystal", "deuterium"];

export interface BossConfig {
  enabled: boolean;
  respawnDays: number;
  aggroChance: number;
  regenPercentPerHour: number;
  ships: Record<string, number>;
  tech: { weapon: number; shield: number; armor: number };
  loot: Record<BossResource, number>;
}

export interface BossBattleRow {
  id: string;
  source: "ATTACK" | "EXPEDITION" | "LOOT";
  galaxy: number;
  system: number;
  result: "attacker_win" | "defender_win" | "draw" | null;
  rounds: number;
  attackerLosses: Record<string, number> | null;
  bossLosses: Record<string, number> | null;
  damage: number;
  bossHealthAfter: number | null;
  killed: boolean;
  loot: Record<BossResource, number> | null;
  createdAt: string;
}

export interface BossState {
  enabled: boolean;
  aggroChance: number;
  regenPercentPerHour: number;
  respawnDays: number;
  loot: Record<BossResource, number>;
  boss: {
    nameId: number;
    galaxy: number;
    system: number;
    position: number;
    spawnedAt: string;
    health: number;
    ships: Record<string, number>;
    maxShips: Record<string, number>;
    top: { username: string; damage: number; battles: number }[];
    mine: { damage: number; battles: number } | null;
  } | null;
  nextSpawn: string | null;
  lastDeath: { diedAt: string | null; killedBy: string | null } | null;
  battles: BossBattleRow[];
}

export interface BossAdmin {
  config: BossConfig;
  defaults: BossConfig;
  sellableShips: { id: number; name: string }[];
  boss: { id: string; nameId: number; galaxy: number; system: number; spawnedAt: string; health: number; ships: Record<string, number> } | null;
  history: { id: string; nameId: number; galaxy: number; system: number; diedAt: string | null; respawnAt: string | null }[];
  fleetValue: number;
}

export const bossApi = {
  state: () => apiClient.get<BossState>("/boss"),
  admin: () => apiClient.get<BossAdmin>("/admin/boss"),
  update: (config: BossConfig) => apiClient.put<BossAdmin>("/admin/boss/config", config),
  reset: () => apiClient.delete<BossAdmin>("/admin/boss/config"),
  spawn: (place?: { galaxy: number; system: number }) => apiClient.post<BossAdmin>("/admin/boss/spawn", place ?? {}),
  despawn: () => apiClient.post<BossAdmin>("/admin/boss/despawn"),
};
