import { BadRequestException } from '@nestjs/common';

/** Client transactionnel minimal (compatible avec Prisma.TransactionClient). */
export interface AtomicTx {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  planet: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  ship: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
}

export interface ResourceCost {
  metal: number;
  crystal: number;
  deuterium: number;
}

/**
 * Verrouille la ligne planète jusqu'à la fin de la transaction (ECO-03) :
 * sérialise les achats, files et envois de flotte d'une même planète.
 */
export async function lockPlanet(tx: AtomicTx, planetId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Planet" WHERE "id" = ${planetId} FOR UPDATE`;
}

/** Verrouille la ligne utilisateur (quotas par joueur : file de recherche, nombre de planètes). */
export async function lockUser(tx: AtomicTx, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

/**
 * Débit conditionnel : n'écrit que si le stock actuel couvre le coût, sinon
 * lève « Ressources insuffisantes » sans rien modifier (jamais de stock négatif).
 */
export async function debitResources(tx: AtomicTx, planetId: string, cost: ResourceCost) {
  const result = await tx.planet.updateMany({
    where: {
      id: planetId,
      metal: { gte: cost.metal },
      crystal: { gte: cost.crystal },
      deuterium: { gte: cost.deuterium },
    },
    data: {
      metal: { decrement: cost.metal },
      crystal: { decrement: cost.crystal },
      deuterium: { decrement: cost.deuterium },
    },
  });

  if (result.count !== 1) {
    throw new BadRequestException('Ressources insuffisantes');
  }
}

/** Retire des vaisseaux uniquement s'ils sont disponibles en quantité suffisante. */
export async function debitShips(
  tx: AtomicTx,
  planetId: string,
  shipId: number,
  amount: number,
  message = 'Vaisseaux insuffisants',
) {
  const result = await tx.ship.updateMany({
    where: { planetId, shipId, amount: { gte: amount } },
    data: { amount: { decrement: amount } },
  });

  if (result.count !== 1) {
    throw new BadRequestException(message);
  }
}
