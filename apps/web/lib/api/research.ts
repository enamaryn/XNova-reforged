import { apiClient } from './client';

export interface ResearchCost {
  metal: number;
  crystal: number;
  deuterium: number;
  energy?: number;
}

export interface TechnologyInfo {
  id: number;
  name: string;
  description: string;
  category: 'basic' | 'drive' | 'advanced' | 'combat';
  currentLevel: number;
  maxLevel: number;
  isMaxLevel: boolean;
  cost: ResearchCost;
  buildTime: number;
  canResearch: boolean;
  canAfford: boolean;
  inQueue: boolean;
  queueEndTime?: string;
  missingRequirements: string[];
  queueBlocked?: boolean;
}

export interface TechnologiesResponse {
  planetId: string;
  technologies: TechnologyInfo[];
  resources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface ResearchQueueItem {
  id: string;
  techId: number;
  techName: string;
  targetLevel: number;
  startTime: string;
  endTime: string;
  remainingSeconds: number;
}

export interface StartResearchResponse {
  success: boolean;
  queueId: string;
  techId: number;
  techName: string;
  targetLevel: number;
  startTime: string;
  endTime: string;
  cost: ResearchCost;
  remainingResources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface CancelResearchResponse {
  success: boolean;
  refund: ResearchCost;
  remainingResources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export const researchApi = {
  getTechnologies: (planetId: string) =>
    apiClient.get<TechnologiesResponse>(`/technologies?planetId=${planetId}`),

  startResearch: (planetId: string, techId: number) =>
    apiClient.post<StartResearchResponse>('/research', { planetId, techId }),

  getResearchQueue: () =>
    apiClient.get<ResearchQueueItem[]>('/research-queue'),

  cancelResearch: (queueId: string) =>
    apiClient.delete<CancelResearchResponse>(`/research-queue/${queueId}`),
};
