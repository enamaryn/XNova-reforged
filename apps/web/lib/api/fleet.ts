import { apiClient } from './client';

export interface AvailableShip {
  shipId: number;
  name: string;
  amount: number;
}

export interface AvailableShipsResponse {
  planetId: string;
  ships: AvailableShip[];
}

export interface ActiveFleet {
  id: string;
  fromGalaxy: number;
  fromSystem: number;
  fromPosition: number;
  toGalaxy: number;
  toSystem: number;
  toPosition: number;
  mission: number;
  ships: Record<string, number>;
  cargo: Record<string, number>;
  startTime: string;
  arrivalTime: string;
  returnTime?: string | null;
  status: string;
}

export function getAvailableShips(planetId: string) {
  return apiClient.get<AvailableShipsResponse>(`/fleet/available/${planetId}`);
}

export function getActiveFleets() {
  return apiClient.get<ActiveFleet[]>(`/fleet/active`);
}

export interface SendFleetPayload {
  planetId: string;
  toGalaxy: number;
  toSystem: number;
  toPosition: number;
  mission: number;
  speedPercent: number;
  ships: Record<string, number>;
  cargo?: {
    metal?: number;
    crystal?: number;
    deuterium?: number;
  };
}

export interface SendFleetResponse {
  success: boolean;
  fleetId: string;
  durationSeconds: number;
  fuelConsumption: number;
  mission: number;
  arrivalTime: string;
}

export function sendFleet(payload: SendFleetPayload) {
  return apiClient.post<SendFleetResponse>('/fleet/send', payload);
}

export interface RecallFleetResponse {
  success: boolean;
  fleetId: string;
  returnTime: string;
}

export function recallFleet(fleetId: string) {
  return apiClient.delete<RecallFleetResponse>(`/fleet/${fleetId}`);
}
