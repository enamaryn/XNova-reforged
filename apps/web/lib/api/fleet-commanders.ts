import { apiClient } from "./client";

export type CommanderSkill = "attack" | "defense" | "speed" | "cargo";

export interface FleetCommander {
  id: string;
  name: string;
  level: number;
  experience: number;
  levelStartExperience: number;
  nextLevelExperience: number | null;
  skillPoints: number;
  skills: Record<CommanderSkill, number>;
  bonuses: Record<CommanderSkill, number>;
  busy: boolean;
}

export interface FleetCommandersOverview {
  cost: number;
  max: number;
  maxLevel: number;
  maxSkill: number;
  commanders: FleetCommander[];
}

export const fleetCommandersApi = {
  list: () => apiClient.get<FleetCommandersOverview>("/fleet-commanders"),
  recruit: (name: string, planetId: string) =>
    apiClient.post<FleetCommandersOverview>("/fleet-commanders", { name, planetId }),
  spend: (id: string, skill: CommanderSkill) =>
    apiClient.post<FleetCommandersOverview>(`/fleet-commanders/${id}/skills/${skill}`, {}),
  dismiss: (id: string) => apiClient.delete<FleetCommandersOverview>(`/fleet-commanders/${id}`),
};
