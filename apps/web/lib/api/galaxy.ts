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
