import { apiClient } from './client';

// Types pour les bâtiments
export interface BuildingCost {
  metal: number;
  crystal: number;
  deuterium: number;
  energy: number;
}

export interface BuildingInfo {
  id: number;
  name: string;
  description: string;
  category: 'resource' | 'facility' | 'station' | 'defense' | 'moon';
  currentLevel: number;
  maxLevel: number;
  isMaxLevel: boolean;
  cost: BuildingCost;
  buildTime: number; // en secondes
  canBuild: boolean;
  canAfford: boolean;
  inQueue: boolean;
  queueEndTime?: string;
  missingRequirements: string[];
}

export interface PlanetBuildings {
  planetId: string;
  buildings: BuildingInfo[];
  resources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface BuildQueueItem {
  id: string;
  buildingId: number;
  buildingName: string;
  targetLevel: number;
  startTime: string;
  endTime: string;
  remainingSeconds: number;
}

export interface StartBuildResponse {
  success: boolean;
  queueId: string;
  buildingId: number;
  buildingName: string;
  targetLevel: number;
  startTime: string;
  endTime: string;
  cost: BuildingCost;
  remainingResources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface CancelBuildResponse {
  success: boolean;
  refund: BuildingCost;
  remainingResources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

// API calls
export const buildingsApi = {
  // Liste des bâtiments disponibles pour une planète
  getPlanetBuildings: (planetId: string) =>
    apiClient.get<PlanetBuildings>(`/planets/${planetId}/buildings`),

  // Démarrer une construction
  startBuild: (planetId: string, buildingId: number) =>
    apiClient.post<StartBuildResponse>(`/planets/${planetId}/build`, { buildingId }),

  // Récupérer la file d'attente
  getBuildQueue: (planetId: string) =>
    apiClient.get<BuildQueueItem[]>(`/planets/${planetId}/build-queue`),

  // Annuler une construction
  cancelBuild: (planetId: string, queueId: string) =>
    apiClient.delete<CancelBuildResponse>(`/planets/${planetId}/build-queue/${queueId}`),
};
