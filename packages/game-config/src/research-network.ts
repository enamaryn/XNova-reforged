// Réseau de recherche intergalactique : relie les laboratoires des planètes du joueur.

/** Technologie qui relie les laboratoires. */
export const RESEARCH_NETWORK_TECH_ID = 123;

/**
 * Niveau de laboratoire effectif d'une recherche lancée sur une planète : son propre laboratoire, plus les
 * `niveau du réseau` laboratoires les plus élevés parmi les AUTRES planètes du joueur (les lunes n'en ont pas).
 * Sans réseau (niveau 0), c'est le laboratoire local seul.
 */
export function linkedLabLevel(
  ownLab: number,
  otherLabs: readonly number[],
  networkLevel: number,
): { effective: number; linked: number } {
  const own = Math.max(0, Math.floor(ownLab || 0));
  const count = Math.max(0, Math.floor(networkLevel || 0));
  const best = [...otherLabs]
    .map((level) => Math.max(0, Math.floor(level || 0)))
    .filter((level) => level > 0)
    .sort((a, b) => b - a)
    .slice(0, count);
  return { effective: own + best.reduce((sum, level) => sum + level, 0), linked: best.length };
}
