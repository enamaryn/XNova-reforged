import { apiClient } from "./client";

export type NpcResource = "metal" | "crystal" | "deuterium";
export const NPC_RESOURCES: NpcResource[] = ["metal", "crystal", "deuterium"];
export type NpcSeason = "winter" | "spring" | "summer" | "autumn";

export interface NpcSeasonSettings {
  values: Record<NpcResource, number>;
  spreadReduction: number;
  shipDiscount: number;
}

export interface NpcTradeConfig {
  enabled: boolean;
  spread: number;
  dailyVariation: number;
  exchangeDailyCap: number;
  shipDailyCap: number;
  shipPriceMultiplier: number;
  ships: number[];
  seasons: Record<NpcSeason, NpcSeasonSettings>;
}

export interface NpcTradeState {
  enabled: boolean;
  season: NpcSeason;
  day: string;
  spread: number;
  shipPriceFactor: number;
  rates: { give: NpcResource; want: NpcResource; rate: number }[];
  ships: { id: number; price: Record<NpcResource, number>; value: number }[];
  caps: { exchange: { cap: number; used: number }; ship: { cap: number; used: number } };
  resetsAt: string;
}

export interface NpcTradeAdmin {
  config: NpcTradeConfig;
  defaults: NpcTradeConfig;
  seasons: NpcSeason[];
  season: NpcSeason;
  sellableShips: { id: number; name: string; cost: Record<NpcResource, number> }[];
}

export const npcTradeApi = {
  state: () => apiClient.get<NpcTradeState>("/npc-trade"),
  exchange: (body: { planetId: string; give: string; want: string; amount: number }) =>
    apiClient.post<{ give: NpcResource; want: NpcResource; given: number; received: number; rate: number }>(
      "/npc-trade/exchange",
      body,
    ),
  buyShips: (body: { planetId: string; shipId: number; amount: number }) =>
    apiClient.post<{ shipId: number; amount: number }>("/npc-trade/ships", body),
  admin: () => apiClient.get<NpcTradeAdmin>("/admin/npc-trade"),
  update: (config: NpcTradeConfig) => apiClient.put<NpcTradeAdmin>("/admin/npc-trade", config),
  reset: () => apiClient.delete<NpcTradeAdmin>("/admin/npc-trade"),
};
