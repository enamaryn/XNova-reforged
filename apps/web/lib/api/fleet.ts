import { apiClient } from './client';

export interface AvailableShip {
  shipId: number;
  name: string;
  amount: number;
}

export interface AvailableShipsResponse {
  planetId: string;
  ships: AvailableShip[];
  fleetSlots?: { inFlight: number; max: number };
}

export interface ActiveFleet {
  id: string;
  fromGalaxy: number;
  fromSystem: number;
  fromPosition: number;
  toGalaxy: number;
  toSystem: number;
  toPosition: number;
  fromMoon?: boolean;
  toMoon?: boolean;
  holdHours?: number | null;
  holdUntil?: string | null;
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
  toMoon?: boolean;
  holdHours?: number;
  mission: number;
  speedPercent: number;
  ships: Record<string, number>;
  cargo?: {
    metal?: number;
    crystal?: number;
    deuterium?: number;
  };
  planetName?: string;
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

export interface SpyReportSummary {
  id: string;
  galaxy: number;
  system: number;
  position: number;
  planetName: string;
  probes: number;
  infoLevel: number;
  createdAt: string;
}

export interface SpyReportDetail extends SpyReportSummary {
  attackerId: string;
  defenderId: string;
  data: {
    resources: { metal: number; crystal: number; deuterium: number };
    ships?: Record<string, number>;
    defenses?: Record<string, number>;
    buildings?: Record<string, number>;
    technologies?: Record<string, number>;
  };
}

export function getSpyReports() {
  return apiClient.get<SpyReportSummary[]>('/spy-reports');
}

export function getSpyReport(reportId: string) {
  return apiClient.get<SpyReportDetail>(`/spy-reports/${reportId}`);
}

export type ExpeditionOutcome =
  | 'nothing'
  | 'resources'
  | 'ships'
  | 'delay'
  | 'speedup'
  | 'pirates'
  | 'blackhole';

export interface ExpeditionReport {
  id: string;
  galaxy: number;
  system: number;
  outcome: ExpeditionOutcome;
  details: Record<string, unknown>;
  ships: Record<string, number>;
  createdAt: string;
}

export function getExpeditionReports() {
  return apiClient.get<ExpeditionReport[]>('/expedition-reports');
}
