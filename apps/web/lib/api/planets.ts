import { apiClient } from './client';

export interface Planet {
  id: string;
  userId: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetType: string;
  metal: number;
  crystal: number;
  deuterium: number;
  fieldsUsed: number;
  fieldsMax: number;
  storage: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
  productionLevel: number;
}

/**
 * Récupérer toutes les planètes de l'utilisateur connecté
 */
export async function getUserPlanets(): Promise<Planet[]> {
  return await apiClient.get<Planet[]>('/planets');
}

/**
 * Récupérer une planète spécifique
 */
export async function getPlanet(planetId: string): Promise<Planet> {
  return await apiClient.get<Planet>(`/planets/${planetId}`);
}

/**
 * Renommer une planète
 */
export async function renamePlanet(planetId: string, name: string) {
  return await apiClient.put<{ id: string; name: string; galaxy: number; system: number; position: number }>(
    `/planets/${planetId}`,
    { name },
  );
}
