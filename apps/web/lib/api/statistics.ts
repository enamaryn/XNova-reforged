import { apiClient } from "./client";

export interface StatisticsPlayer {
  id: string;
  username: string;
  points: number;
  rank: number;
}

export interface StatisticsAlliance {
  id: string;
  tag: string;
  name: string;
  members: number;
  points: number;
}

export interface StatisticsPersonal {
  id: string;
  username: string;
  points: number;
  rank: number;
  createdAt: string;
  planets: number;
  alliance: { id: string; tag: string; name: string } | null;
}

export interface StatisticsOverview {
  personal: StatisticsPersonal;
  topPlayers: StatisticsPlayer[];
  topAlliances: StatisticsAlliance[];
}

export function getStatistics() {
  return apiClient.get<StatisticsOverview>("/statistics");
}
