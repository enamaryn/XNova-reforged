import { apiClient } from "./client";

export interface AdminConfig {
  gameSpeed: number;
  fleetSpeed: number;
  resourceMultiplier: number;
  planetSize: number;
  baseMetal: number;
  baseCrystal: number;
  baseDeuterium: number;
}

export interface AdminOverview {
  players: number;
  alliances: number;
  planets: number;
  onlinePlayers: number;
  serverTime: string;
}

export function getAdminConfig() {
  return apiClient.get<AdminConfig>("/admin/config");
}

export function updateAdminConfig(payload: Partial<AdminConfig>) {
  return apiClient.put<AdminConfig>("/admin/config", payload);
}

export function getAdminOverview() {
  return apiClient.get<AdminOverview>("/admin/overview");
}
