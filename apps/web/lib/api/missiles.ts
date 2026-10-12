import { apiClient } from "./client";

export interface MissileCoords {
  galaxy: number;
  system: number;
  position: number;
}

export interface MissileStrikeResult {
  launched: number;
  intercepted: number;
  hits: number;
  destroyed: Record<string, number>;
  lost?: boolean;
}

export interface MissileStrike {
  id: string;
  from: MissileCoords;
  to: MissileCoords;
  missiles: number;
  primaryTarget: number | null;
  startTime: string;
  arrivalTime: string;
  status: "traveling" | "resolved";
  result: MissileStrikeResult | null;
}

export interface MissileOverview {
  planetId: string;
  silo: { level: number; capacity: number; stored: number; inQueue: number };
  interplanetary: number;
  interception: number;
  range: number;
  galaxy: number;
  system: number;
  targets: number[];
  outgoing: MissileStrike[];
  incoming: MissileStrike[];
}

export const missilesApi = {
  overview: (planetId: string) => apiClient.get<MissileOverview>(`/missiles/${planetId}`),

  launch: (payload: {
    planetId: string;
    toGalaxy: number;
    toSystem: number;
    toPosition: number;
    amount: number;
    primaryTarget?: number;
  }) =>
    apiClient.post<{ success: boolean; strikeId: string; durationSeconds: number; arrivalTime: string }>(
      "/missiles/launch",
      payload,
    ),
};
