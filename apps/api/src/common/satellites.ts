import { Prisma } from '@prisma/client';
import { SOLAR_SATELLITE_ID } from '@xnova/game-config';
import { updateResources, type ResourceConfig } from '@xnova/game-engine';

/**
 * Les satellites solaires sont des lignes `Ship` de la planète (ils ne quittent jamais leur orbite) :
 * tout calcul d'énergie charge cette relation en plus des niveaux de bâtiments.
 */
export const SATELLITES_INCLUDE = {
  ships: { where: { shipId: SOLAR_SATELLITE_ID }, select: { amount: true } },
} as const;

/** Nombre de satellites solaires d'une planète chargée avec SATELLITES_INCLUDE. */
export function countSatellites(planet: { ships?: Array<{ amount: number }> }): number {
  return (planet.ships ?? []).reduce((sum, row) => sum + row.amount, 0);
}

/**
 * Règle la production avec l'ANCIEN nombre de satellites jusqu'à maintenant, puis fixe le rendement du nouveau
 * nombre : le changement (livraison ou destruction) n'est jamais appliqué rétroactivement au temps écoulé.
 * À appeler dans la transaction qui modifie les lignes `Ship`, après le verrou de la planète et avant la modification.
 */
export async function settleBeforeSatelliteChange(
  tx: Prisma.TransactionClient,
  planetId: string,
  config: ResourceConfig,
  delta: number,
) {
  const planet = await tx.planet.findUniqueOrThrow({
    where: { id: planetId },
    include: SATELLITES_INCLUDE,
  });
  const before = countSatellites(planet);
  const after = Math.max(0, before + delta);
  const now = new Date(Math.max(Date.now(), planet.lastUpdate.getTime()));
  const settled = updateResources({
    resources: planet,
    levels: { ...planet, solarSatellites: before },
    lastUpdate: planet.lastUpdate,
    now,
    config,
  });
  const next = updateResources({
    resources: settled.resources,
    levels: { ...planet, solarSatellites: after },
    lastUpdate: now,
    now,
    config,
  });
  await tx.planet.update({
    where: { id: planetId },
    data: {
      ...settled.resources,
      metalProduction: next.productionPerHour.metal,
      crystalProduction: next.productionPerHour.crystal,
      deuteriumProduction: next.productionPerHour.deuterium,
      energyUsed: next.energy.used,
      energyAvailable: next.energy.available,
      lastUpdate: now,
    },
  });
}
