import type { Prisma } from '@prisma/client';
import { canonicalizeEmail } from '@xnova/game-config';

type Client = Pick<Prisma.TransactionClient, 'user'>;

/**
 * Une autre boîte mail canonique identique existe-t-elle déjà (alias +tag, points Gmail) ? `exceptUserId` exclut
 * le compte qui change d'adresse. Complète l'unicité exacte de la colonne `email`.
 */
export async function canonicalEmailTaken(client: Client, email: string, exceptUserId?: string): Promise<boolean> {
  const found = await client.user.findFirst({
    where: { emailCanonical: canonicalizeEmail(email), ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });
  return found !== null;
}
