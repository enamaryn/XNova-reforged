import { Prisma } from '@prisma/client';
import { SOLAR_SATELLITE_ID } from '@xnova/game-config';
import { updateResources, type ResourceConfig } from '@xnova/game-engine';

/** Technologie Énergie : relève le rendement de la centrale à fusion de toutes les planètes du joueur. */
export const ENERGY_TECH_ID = 113;

/**
 * Sources d'énergie qui ne sont pas des colonnes de la planète : les satellites solaires (lignes `Ship` de la
 * planète, en orbite) et la technologie Énergie du propriétaire. Tout calcul de production charge cette relation.
 */
export const ENERGY_SOURCES_INCLUDE = {
  ships: { where: { shipId: SOLAR_SATELLITE_ID }, select: { amount: true } },
  user: {
    select: { technologies: { where: { techId: ENERGY_TECH_ID }, select: { level: true } } },
  },
} as const;

type WithEnergySources = {
  ships?: Array<{ amount: number }>;
  user?: { technologies?: Array<{ level: number }> } | null;
};

/** Valeurs à ajouter aux niveaux de bâtiments d'une planète chargée avec ENERGY_SOURCES_INCLUDE. */
export function energySourcesOf(planet: WithEnergySources): {
  solarSatellites: number;
  energyTechnology: number;
} {
  return {
    solarSatellites: (planet.ships ?? []).reduce((sum, row) => sum + row.amount, 0),
    energyTechnology: planet.user?.technologies?.[0]?.level ?? 0,
  };
}

/**
 * Règle la production avec les ANCIENNES sources d'énergie jusqu'à maintenant, puis fixe le rendement des
 * nouvelles : un changement (livraison ou destruction de satellites, niveau de technologie Énergie) n'est jamais
 * appliqué rétroactivement au temps écoulé. À appeler dans la transaction qui modifie les données, après le
 * verrou de la planète et avant la modification.
 */
export async function settleBeforeEnergyChange(
  tx: Prisma.TransactionClient,
  planetId: string,
  config: ResourceConfig,
  change: { satellitesDelta?: number; energyTechnology?: number },
) {
  const planet = await tx.planet.findUniqueOrThrow({
    where: { id: planetId },
    include: ENERGY_SOURCES_INCLUDE,
  });
  const before = energySourcesOf(planet);
  const after = {
    solarSatellites: Math.max(0, before.solarSatellites + (change.satellitesDelta ?? 0)),
    energyTechnology: change.energyTechnology ?? before.energyTechnology,
  };
  const now = new Date(Math.max(Date.now(), planet.lastUpdate.getTime()));
  const settled = updateResources({
    resources: planet,
    levels: { ...planet, ...before },
    lastUpdate: planet.lastUpdate,
    now,
    config,
  });
  const next = updateResources({
    resources: settled.resources,
    levels: { ...planet, ...after },
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
