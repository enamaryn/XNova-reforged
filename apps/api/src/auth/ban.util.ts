/** Un compte est suspendu si banni sans echeance, ou avec une echeance non atteinte. */
export function isBanned(
  user: { bannedAt: Date | null; bannedUntil: Date | null },
  now: Date = new Date(),
): boolean {
  return !!user.bannedAt && (!user.bannedUntil || user.bannedUntil > now);
}
