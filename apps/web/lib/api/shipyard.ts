import { apiClient } from './client';

export interface ShipCost {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface ShipyardShip {
  id: number;
  name: string;
  description: string;
  cost: ShipCost;
  buildTime: number;
  currentAmount: number;
  canBuild: boolean;
  canAfford: boolean;
  inQueue: boolean;
  missingRequirements: string[];
}

export interface ShipyardResponse {
  planetId: string;
  ships: ShipyardShip[];
  resources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface ShipyardQueueItem {
  id: string;
  shipId: number;
  shipName: string;
  amount: number;
  startTime: string;
  endTime: string;
  remainingSeconds: number;
}

export interface StartShipBuildPayload {
  planetId: string;
  shipId: number;
  amount: number;
}

export interface StartShipBuildResponse {
  success: boolean;
  queueId: string;
  shipId: number;
  shipName: string;
  amount: number;
  startTime: string;
  endTime: string;
  cost: ShipCost;
  remainingResources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface CancelShipBuildResponse {
  success: boolean;
  refund: ShipCost;
  remainingResources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export const shipyardApi = {
  getShipyard: (planetId: string) =>
    apiClient.get<ShipyardResponse>(`/shipyard?planetId=${planetId}`),

  startBuild: (payload: StartShipBuildPayload) =>
    apiClient.post<StartShipBuildResponse>('/shipyard/build', payload),

  getQueue: (planetId: string) =>
    apiClient.get<ShipyardQueueItem[]>(`/shipyard/queue?planetId=${planetId}`),

  cancelBuild: (queueId: string) =>
    apiClient.delete<CancelShipBuildResponse>(`/shipyard/queue/${queueId}`),
};
