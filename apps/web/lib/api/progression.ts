import { apiClient } from "./client";
export interface Progression {
  commanderLevel: number;
  development: number;
  nextLevelDevelopment: number | null;
  levelDevelopment: number;
  power: number;
  colonies: number;
  breakdown: {
    buildings: number;
    research: number;
    ships: number;
    defenses: number;
    colonies: number;
  };
  buildingCapacity: number;
  productionCapacity: number;
  constructionTechnology: number;
  productionTechnology: number;
}
export const getProgression = () => apiClient.get<Progression>("/progression");
