import { apiClient } from "./client";

export interface MoonOverview {
  moonId: string;
  deuterium: number;
  phalanx: { level: number; range: number; cost: number; galaxy: number; system: number };
  jumpGate: {
    level: number;
    readyAt: string | null;
    cooldownSeconds: number;
    destinations: {
      id: string;
      name: string;
      galaxy: number;
      system: number;
      position: number;
      jumpGate: number;
      jumpGateReadyAt: string | null;
    }[];
  };
}

export interface PhalanxCoords {
  galaxy: number;
  system: number;
  position: number;
  moon?: boolean;
}

export interface PhalanxMovement {
  mission: number;
  direction: "outbound" | "inbound" | "returning";
  from: PhalanxCoords;
  to: PhalanxCoords;
  time: string | null;
  ships: number;
}

export interface PhalanxResult {
  target: PhalanxCoords;
  cost: number;
  movements: PhalanxMovement[];
}

export const moonsApi = {
  overview: (moonId: string) => apiClient.get<MoonOverview>(`/moons/${moonId}`),

  scan: (moonId: string, target: PhalanxCoords) =>
    apiClient.post<PhalanxResult>(`/moons/${moonId}/phalanx`, {
      galaxy: target.galaxy,
      system: target.system,
      position: target.position,
    }),

  jump: (moonId: string, toMoonId: string, ships: Record<string, number>) =>
    apiClient.post<{ success: boolean; readyAt: string; cooldownSeconds: number }>(
      `/moons/${moonId}/jump`,
      { toMoonId, ships },
    ),
};
