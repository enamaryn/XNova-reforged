/**
 * Répartit les pertes de vaisseaux d'un camp défenseur entre ses propriétaires (la planète hôte et les flottes
 * alliées en maintien de position), proportionnellement au nombre de vaisseaux de chaque type
 * (méthode du plus fort reste, ordre des propriétaires pour départager).
 */
export function distributeShipLosses(
  losses: Record<number, number>,
  owners: { key: string; ships: Record<number, number> }[],
): Record<string, Record<number, number>> {
  const result: Record<string, Record<number, number>> = {};
  for (const owner of owners) result[owner.key] = {};

  for (const [idRaw, lostRaw] of Object.entries(losses)) {
    const id = Number(idRaw);
    const lost = Math.max(0, Math.floor(Number(lostRaw) || 0));
    if (lost === 0) continue;
    const counts = owners.map((o) => Math.max(0, Math.floor(o.ships[id] ?? 0)));
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const toLose = Math.min(lost, total);

    const shares = counts.map((count, index) => {
      const exact = (count * toLose) / total;
      return { index, base: Math.floor(exact), rest: exact - Math.floor(exact), count };
    });
    let remaining = toLose - shares.reduce((a, s) => a + s.base, 0);
    const byRest = [...shares].sort((a, b) => b.rest - a.rest || a.index - b.index);
    for (const share of byRest) {
      if (remaining <= 0) break;
      if (share.base < share.count) {
        share.base += 1;
        remaining -= 1;
      }
    }
    for (const share of shares) {
      if (share.base > 0) result[owners[share.index].key][id] = share.base;
    }
  }
  return result;
}
