import { apiClient } from "./client";

export interface OfficerBonusValues {
  energy?: number;
  mineProduction?: number;
  storage?: number;
  buildTimeReduction?: number;
  researchTimeReduction?: number;
  fleetSpeed?: number;
  extraExpeditions?: number;
  extraBuildSlots?: number;
  espionageLevels?: number;
}

export interface OfficersOverview {
  cost: number;
  officers: { type: string; bonus: OfficerBonusValues; hired: boolean; hiredAt: string | null }[];
  active: Required<OfficerBonusValues>;
}

export const officersApi = {
  list: () => apiClient.get<OfficersOverview>("/officers"),
  hire: (type: string, planetId: string) =>
    apiClient.post<OfficersOverview>(`/officers/${type}/hire`, { planetId }),
};
