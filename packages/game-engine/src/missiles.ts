import {
  DEFENSES,
  MISSILE_DAMAGE,
  MISSILE_TARGET_ORDER,
} from '@xnova/game-config';

export interface MissileStrikeInput {
  /** Missiles interplanétaires tirés. */
  missiles: number;
  /** Missiles d'interception stockés par le défenseur. */
  antiBallistic: number;
  /** Défenses de la planète visée (identifiant → quantité), missiles exclus. */
  defenses: Record<number, number>;
  /** Niveaux de technologie Armes (attaquant) et Protection des vaisseaux spatiaux (défenseur). */
  attackerWeapon: number;
  defenderArmor: number;
  /** Défense visée en priorité (facultatif) ; sinon l'ordre par défaut s'applique. */
  primaryTarget?: number | null;
}

export interface MissileStrikeResult {
  launched: number;
  intercepted: number;
  /** Missiles d'interception consommés (un par missile abattu). */
  antiBallisticUsed: number;
  hits: number;
  /** Défenses détruites par type. */
  destroyed: Record<number, number>;
}

/**
 * Résout une frappe de missiles : les missiles d'interception abattent d'abord autant de missiles
 * (un pour un), puis chaque missile restant inflige des dégâts qui détruisent des défenses entières,
 * la cible choisie d'abord puis l'ordre par défaut. Les dégâts qui ne suffisent pas à détruire
 * une unité sont perdus.
 */
export function resolveMissileStrike(input: MissileStrikeInput): MissileStrikeResult {
  const launched = Math.max(0, Math.floor(input.missiles));
  const anti = Math.max(0, Math.floor(input.antiBallistic));
  const intercepted = Math.min(launched, anti);
  const hits = launched - intercepted;
  const destroyed: Record<number, number> = {};

  let damage = hits * MISSILE_DAMAGE * (1 + 0.1 * Math.max(0, input.attackerWeapon));
  const order = [
    ...(input.primaryTarget && MISSILE_TARGET_ORDER.includes(input.primaryTarget)
      ? [input.primaryTarget]
      : []),
    ...MISSILE_TARGET_ORDER.filter((id) => id !== input.primaryTarget),
  ];

  for (const id of order) {
    if (damage <= 0) break;
    const count = Math.max(0, Math.floor(input.defenses[id] ?? 0));
    const definition = DEFENSES[id];
    if (count === 0 || !definition) continue;
    const hull = Math.floor(definition.stats.hull * (1 + 0.1 * Math.max(0, input.defenderArmor)));
    if (hull <= 0) continue;
    const killed = Math.min(count, Math.floor(damage / hull));
    if (killed > 0) {
      destroyed[id] = killed;
      damage -= killed * hull;
    }
    // Les dégâts restants ne suffisent pas à finir une unité de ce type : ils sont perdus ici.
    if (killed < count) damage = 0;
  }

  return { launched, intercepted, antiBallisticUsed: intercepted, hits, destroyed };
}
