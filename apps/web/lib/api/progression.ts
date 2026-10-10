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

export type OnboardingStepStatus = "done" | "current" | "upcoming";
export interface OnboardingStep {
  id: string;
  route: "buildings" | "research" | "shipyard" | "fleet" | "reports" | "overview";
  targetId?: number;
  status: OnboardingStepStatus;
}
export interface OnboardingProgress {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  currentStepId: string | null;
  finished: boolean;
}
export const getOnboarding = () =>
  apiClient.get<OnboardingProgress>("/progression/onboarding");
