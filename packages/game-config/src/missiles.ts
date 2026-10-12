// Missiles interplanétaires : constantes et formules communes à l'API et à l'interface.

/** Silo de missiles : bâtiment qui range les missiles. */
export const MISSILE_SILO_ID = 44;
/** Missile interplanétaire : détruit des défenses de la planète visée. */
export const INTERPLANETARY_MISSILE_ID = 502;
/** Missile d'interception : abat un missile interplanétaire à l'arrivée. */
export const ANTI_BALLISTIC_MISSILE_ID = 503;
export const MISSILE_IDS: readonly number[] = [INTERPLANETARY_MISSILE_ID, ANTI_BALLISTIC_MISSILE_ID];

/** Un niveau de silo range 10 missiles (de l'un ou l'autre type). */
export const MISSILES_PER_SILO_LEVEL = 10;
/** Dégâts d'un missile interplanétaire, avant bonus de la technologie Armes (+10 % par niveau). */
export const MISSILE_DAMAGE = 12000;
/** Technologies utilisées : portée (Réacteur à impulsion), dégâts (Armes), résistance des défenses (Protection). */
export const MISSILE_RANGE_TECH_ID = 117;
export const MISSILE_WEAPON_TECH_ID = 109;
export const MISSILE_ARMOR_TECH_ID = 110;

/** Ordre de destruction par défaut des défenses (après la cible choisie par l'attaquant). */
export const MISSILE_TARGET_ORDER: readonly number[] = [401, 402, 403, 404, 405, 406, 407, 408];

/** Capacité du silo, en nombre de missiles. */
export function missileCapacity(siloLevel: number): number {
  return Math.max(0, Math.floor(siloLevel || 0)) * MISSILES_PER_SILO_LEVEL;
}

/** Portée en systèmes, dans la même galaxie : 5 par niveau de Réacteur à impulsion, moins 1. */
export function missileRange(impulseLevel: number): number {
  const level = Math.max(0, Math.floor(impulseLevel || 0));
  return level === 0 ? 0 : level * 5 - 1;
}

/** Durée de vol en secondes avant application de la vitesse du serveur : 30 s + 60 s par système traversé. */
export function missileFlightSeconds(systemDistance: number): number {
  return 30 + 60 * Math.max(0, Math.floor(systemDistance || 0));
}
