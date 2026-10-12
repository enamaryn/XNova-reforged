// Lunes : constantes et règles communes à l'API et à l'interface.

/** Bâtiments propres aux lunes (base lunaire, phalange, porte de saut). */
export const MOON_ONLY_BUILDINGS: readonly number[] = [41];
export const MOON_BASE_ID = 41;

/** Bâtiments constructibles sur une lune : robotique, chantier spatial et bâtiments lunaires. */
export const MOON_BUILDINGS: readonly number[] = [14, 21, 41];

/** Une lune naît avec une seule case ; chaque niveau de base lunaire en ajoute 3 (et en occupe une). */
export const MOON_INITIAL_FIELDS = 1;
export const MOON_BASE_FIELDS_PER_LEVEL = 3;

/** Chance de lune : 1 % par 100 000 unités de débris (métal + cristal), plafonnée à 20 %. */
export const MOON_DEBRIS_PER_PERCENT = 100_000;
export const MOON_MAX_CHANCE_PERCENT = 20;

export const MOON_DEFAULT_NAME = 'Lune';

/** Probabilité (en %) qu'un combat laisse une lune, selon les débris produits. */
export function moonChancePercent(debrisMetal: number, debrisCrystal: number): number {
  const total = Math.max(0, Math.floor(debrisMetal || 0)) + Math.max(0, Math.floor(debrisCrystal || 0));
  return Math.min(MOON_MAX_CHANCE_PERCENT, Math.floor(total / MOON_DEBRIS_PER_PERCENT));
}

/** Bâtiments proposés selon que l'on est sur une planète ou sur une lune, parmi ceux qui existent. */
export function buildingsAvailableFor(isMoon: boolean, implemented: readonly number[]): number[] {
  return isMoon
    ? implemented.filter((id) => MOON_BUILDINGS.includes(id))
    : implemented.filter((id) => !MOON_ONLY_BUILDINGS.includes(id));
}
