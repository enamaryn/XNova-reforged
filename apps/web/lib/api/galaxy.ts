import { apiClient } from './client';

export interface GalaxyPosition {
  position: number;
  occupied: boolean;
  planetId?: string;
  name?: string;
  owner?: string;
  ownerId?: string | null;
  allianceTag?: string | null;
  activityMinutes?: number | null;
  hasMoon?: boolean;
  isOwn?: boolean;
}

export interface GalaxySystemResponse {
  galaxy: number;
  system: number;
  positions: GalaxyPosition[];
}

export function getGalaxySystem(galaxy: number, system: number) {
  return apiClient.get<GalaxySystemResponse>(`/galaxy/${galaxy}/${system}`);
}

export interface ScanPlanetResponse {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  owner: string;
  resources: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface ColonizePlanetPayload {
  originPlanetId: string;
  galaxy: number;
  system: number;
  position: number;
  name: string;
}

export interface ColonizePlanetResponse {
  success: boolean;
  planetId: string;
  galaxy: number;
  system: number;
  position: number;
  name: string;
}

export function scanPlanet(planetId: string) {
  return apiClient.get<ScanPlanetResponse>(`/planets/scan/${planetId}`);
}

export function colonizePlanet(payload: ColonizePlanetPayload) {
  return apiClient.post<ColonizePlanetResponse>('/planets/colonize', payload);
}
