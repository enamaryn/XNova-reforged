import type { ResourceUpdateResult } from '@xnova/game-engine';

/** Sous-ensemble de la planète nécessaire au rafraîchissement. */
export interface RefreshableSnapshot {
  id: string;
  metal: number;
  crystal: number;
  deuterium: number;
  lastUpdate: Date;
}

/** Sous-ensemble du client Prisma utilisé (client global ou transaction). */
export interface PlanetUpdateManyClient {
  planet: {
    updateMany: (args: {
      where: { id: string; lastUpdate: Date };
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
}

/**
 * Persiste un rafraîchissement de ressources sans écraser les mutations concurrentes (ECO-02).
 *
 * - La production est appliquée en delta (`increment`) : un débit ou un crédit
 *   concurrent (achat, livraison, butin) reste pris en compte.
 * - La ligne n'est mise à jour que si `lastUpdate` est inchangé : deux
 *   rafraîchissements concurrents ne peuvent pas produire deux fois la même période.
 *
 * @returns `true` si ce rafraîchissement a été appliqué, `false` si un autre l'a devancé
 *          (l'appelant doit relire la planète et recalculer, ou abandonner).
 */
export async function persistResourceRefresh(
  client: PlanetUpdateManyClient,
  snapshot: RefreshableSnapshot,
  calculation: ResourceUpdateResult,
): Promise<boolean> {
  // Ne jamais faire reculer lastUpdate : la période serait comptée deux fois.
  const lastUpdate =
    calculation.lastUpdate.getTime() > snapshot.lastUpdate.getTime()
      ? calculation.lastUpdate
      : snapshot.lastUpdate;

  const result = await client.planet.updateMany({
    where: { id: snapshot.id, lastUpdate: snapshot.lastUpdate },
    data: {
      metal: { increment: calculation.resources.metal - snapshot.metal },
      crystal: { increment: calculation.resources.crystal - snapshot.crystal },
      deuterium: { increment: calculation.resources.deuterium - snapshot.deuterium },
      metalProduction: calculation.productionPerHour.metal,
      crystalProduction: calculation.productionPerHour.crystal,
      deuteriumProduction: calculation.productionPerHour.deuterium,
      energyUsed: calculation.energy.used,
      energyAvailable: calculation.energy.available,
      lastUpdate,
    },
  });

  return result.count === 1;
}
