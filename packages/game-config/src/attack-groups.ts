// Attaques groupées (mission 2) : les membres d'une même alliance frappent une cible au même instant.

/** Nombre maximal de flottes dans un même groupe (celle qui le crée comprise). */
export const MAX_GROUP_FLEETS = 5;

/**
 * Retard maximal qu'une flotte plus lente peut imposer à un groupe, en part de la durée prévue à sa création
 * (0,3 = +30 %). Au-delà, la flotte est refusée : elle ne peut pas retarder indéfiniment ceux qui sont déjà partis.
 */
export const GROUP_MAX_DELAY_RATIO = 0.3;

export interface GroupTiming {
  /** Instant où la première flotte est partie. */
  createdAt: Date;
  /** Arrivée prévue à la création du groupe : sert de référence au retard maximal. */
  plannedArrivalTime: Date;
  /** Arrivée actuelle, éventuellement déjà repoussée par des flottes plus lentes. */
  arrivalTime: Date;
}

export type GroupArrival =
  | { ok: true; arrivalTime: Date; delayed: boolean }
  | { ok: false; reason: 'gone' | 'too_slow'; latestArrival: Date };

/**
 * Heure d'arrivée d'un groupe quand une flotte le rejoint. Toutes les flottes arrivent ensemble : le groupe attend
 * la plus lente, tant que le retard total reste dans GROUP_MAX_DELAY_RATIO de la durée prévue à la création.
 *
 * @param ownDurationMs durée de trajet propre de la flotte qui rejoint, comptée à partir de `now`.
 */
export function resolveGroupArrival(group: GroupTiming, now: Date, ownDurationMs: number): GroupArrival {
  const planned = Math.max(0, group.plannedArrivalTime.getTime() - group.createdAt.getTime());
  const latestArrival = new Date(group.createdAt.getTime() + planned * (1 + GROUP_MAX_DELAY_RATIO));
  if (group.arrivalTime.getTime() <= now.getTime()) return { ok: false, reason: 'gone', latestArrival };
  const own = now.getTime() + Math.max(0, ownDurationMs);
  if (own <= group.arrivalTime.getTime()) return { ok: true, arrivalTime: group.arrivalTime, delayed: false };
  if (own <= latestArrival.getTime()) return { ok: true, arrivalTime: new Date(own), delayed: true };
  return { ok: false, reason: 'too_slow', latestArrival };
}
