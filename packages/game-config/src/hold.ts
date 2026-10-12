// Maintien de position chez un allié et dépôt d'alliance : constantes et formules communes à l'API et à l'interface.
import { SHIPS } from './ships.js';

export const ALLIANCE_DEPOT_ID = 34;
/** Durée maximale d'un maintien de position, en heures. */
export const HOLD_MAX_HOURS = 32;
/** Deutérium que le dépôt d'alliance de l'hôte peut fournir, par niveau et par heure de maintien. */
export const DEPOT_SUPPLY_PER_LEVEL_PER_HOUR = 10_000;

/** Carburant d'un maintien de position : un dixième de la consommation de la flotte, par heure. */
export function holdFuelPerHour(ships: Record<number, number>): number {
  const total = Object.entries(ships).reduce(
    (sum, [id, amount]) => sum + (SHIPS[Number(id)]?.consumption ?? 0) * Math.max(0, Math.floor(Number(amount) || 0)),
    0,
  );
  return Math.ceil(total / 10);
}

/** Durée réelle d'un maintien, divisée par la vitesse des flottes du serveur (10 s au minimum). */
export function holdSeconds(hours: number, fleetSpeed: number): number {
  const speed = fleetSpeed > 0 ? fleetSpeed : 1;
  return Math.max(10, Math.ceil((Math.max(0, hours) * 3600) / speed));
}

/**
 * Ravitaillement par le dépôt d'alliance de l'hôte : il prend en charge le carburant de maintien déjà payé par
 * la flotte, dans la limite du niveau du dépôt (par heure de maintien) et du deutérium dont l'hôte dispose.
 */
export function depotSupply(params: {
  prepaid: number;
  hostDeuterium: number;
  depotLevel: number;
  hours: number;
}): number {
  const cap = Math.max(0, Math.floor(params.depotLevel)) * DEPOT_SUPPLY_PER_LEVEL_PER_HOUR * Math.max(0, params.hours);
  return Math.max(0, Math.min(Math.floor(params.prepaid), Math.floor(params.hostDeuterium), cap));
}
