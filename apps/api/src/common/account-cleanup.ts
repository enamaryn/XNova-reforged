import type { Prisma } from '@prisma/client';

type CleanupTx = Pick<Prisma.TransactionClient, 'bossDamage' | 'accountLinkExemption' | 'incident' | 'researchQueue'>;

/**
 * Références à un joueur qui ne passent pas par une clé étrangère : la suppression du compte ne les efface pas en
 * cascade, il faut les nettoyer à la main. Commun à la suppression par le joueur (`AccountService.deleteAccount`) et par
 * un administrateur (`AdminService.managePlayer`), pour qu'elles laissent exactement les mêmes traces.
 *
 * - dégâts infligés à un boss (le butin se verserait sur une planète disparue) ;
 * - exemptions du contrôle des doubles comptes ;
 * - file de recherche (`userId` sans clé étrangère) ;
 * - identifiant dans le journal des incidents techniques : effacé, l'incident reste.
 */
export async function cleanupLooseUserReferences(tx: CleanupTx, userId: string) {
  await tx.bossDamage.deleteMany({ where: { userId } });
  await tx.accountLinkExemption.deleteMany({ where: { OR: [{ userA: userId }, { userB: userId }] } });
  await tx.researchQueue.deleteMany({ where: { userId } });
  await tx.incident.updateMany({ where: { userId }, data: { userId: null } });
}
