import { DEFENSES, GAME_CONSTANTS, SHIPS } from '@xnova/game-config';

export interface CombatTechBonuses {
  weapon: number;
  shield: number;
  armor: number;
  /** Bonus de commandant de flotte (fractions, 0,05 = +5 %) : dégâts, bouclier et coque. */
  weaponBonus?: number;
  shieldBonus?: number;
  armorBonus?: number;
}

export interface CombatResultSummary {
  rounds: number;
  result: 'attacker_win' | 'defender_win' | 'draw';
  attackerRemaining: Record<number, number>;
  /** Survivants de chaque flotte (attaque groupée seulement). */
  attackerGroupsRemaining?: Record<string, Record<number, number>>;
  defenderRemaining: Record<number, number>;
  attackerLosses: Record<number, number>;
  defenderLosses: Record<number, number>;
  timeline: CombatRoundSummary[];
  debris: {
    metal: number;
    crystal: number;
  };
}

export interface CombatRoundSummary {
  round: number;
  attackerRemaining: Record<number, number>;
  defenderRemaining: Record<number, number>;
  attackerLosses: Record<number, number>;
  defenderLosses: Record<number, number>;
}

interface CombatUnit {
  /** Flotte d'origine (attaque groupée) : permet de rendre les survivants de chaque flotte. */
  group?: string;
  shipId: number;
  hull: number;
  shield: number;
  weapon: number;
  maxHull: number;
  maxShield: number;
  /** Tir rapide : pour chaque type de cible, le nombre moyen de tirs enchaînés (probabilité (n−1)/n de rejouer). */
  rapidfire?: Record<number, number>;
}

function applyTech(value: number, level: number, bonus = 0): number {
  // Bonus en millièmes entiers : pas d'erreur flottante sur 1 % × n
  const permille = 1000 + Math.round(Math.max(0, bonus) * 1000);
  return Math.floor((Math.floor(value * (1 + level * 0.1)) * permille) / 1000);
}

function createUnits(
  ships: Record<number, number>,
  tech: CombatTechBonuses,
  group?: string,
): CombatUnit[] {
  const units: CombatUnit[] = [];

  Object.entries(ships).forEach(([shipIdRaw, countRaw]) => {
    const shipId = Number(shipIdRaw);
    const count = Math.max(0, Math.floor(countRaw));
    // Les identifiants de défenses (4xx) et de vaisseaux (2xx) sont disjoints : une même table de combat
    const ship = SHIPS[shipId] ?? DEFENSES[shipId];
    if (!ship || count === 0) return;

    const baseHull = applyTech(ship.stats.hull, tech.armor, tech.armorBonus);
    const baseShield = applyTech(ship.stats.shield, tech.shield, tech.shieldBonus);
    const baseWeapon = applyTech(ship.stats.weapon, tech.weapon, tech.weaponBonus);

    for (let i = 0; i < count; i += 1) {
      units.push({
        group,
        shipId,
        hull: baseHull,
        shield: baseShield,
        weapon: baseWeapon,
        maxHull: baseHull,
        maxShield: baseShield,
        rapidfire: SHIPS[shipId]?.rapidfire,
      });
    }
  });

  return units;
}

function removeUnit(units: CombatUnit[], index: number) {
  const last = units.length - 1;
  if (index < 0 || index > last) return;
  units[index] = units[last];
  units.pop();
}

function countByShip(units: CombatUnit[]): Record<number, number> {
  return units.reduce((acc, unit) => {
    acc[unit.shipId] = (acc[unit.shipId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
}

function computeLosses(
  initial: Record<number, number>,
  remaining: Record<number, number>,
): Record<number, number> {
  const losses: Record<number, number> = {};
  Object.keys(initial).forEach((shipIdRaw) => {
    const shipId = Number(shipIdRaw);
    const lost = (initial[shipId] || 0) - (remaining[shipId] || 0);
    if (lost > 0) {
      losses[shipId] = lost;
    }
  });
  return losses;
}

function computeDebris(
  attackerLosses: Record<number, number>,
  defenderLosses: Record<number, number>,
): { metal: number; crystal: number } {
  let lostMetal = 0;
  let lostCrystal = 0;

  const accumulate = (losses: Record<number, number>) => {
    Object.entries(losses).forEach(([shipIdRaw, countRaw]) => {
      const shipId = Number(shipIdRaw);
      const count = Math.max(0, Math.floor(countRaw));
      const ship = SHIPS[shipId];
      if (!ship) return;
      lostMetal += ship.cost.metal * count;
      lostCrystal += ship.cost.crystal * count;
    });
  };

  accumulate(attackerLosses);
  accumulate(defenderLosses);
  const factor = GAME_CONSTANTS.DEBRIS_FACTOR ?? 0.3;

  return {
    metal: Math.floor(lostMetal * factor),
    crystal: Math.floor(lostCrystal * factor),
  };
}

/**
 * Un tir de `shooter` sur une cible tirée au hasard : le bouclier absorbe d'abord, puis la coque ; une unité
 * dont la coque tombe à 0 est détruite. Retourne la cible touchée (pour le tir rapide).
 */
function fireAt(shooter: CombatUnit, targets: CombatUnit[]): CombatUnit {
  const targetIndex = Math.floor(Math.random() * targets.length);
  const target = targets[targetIndex];

  const damage = shooter.weapon;
  if (target.shield > 0) {
    target.shield -= damage;
    if (target.shield < 0) {
      target.hull += target.shield;
      target.shield = 0;
    }
  } else {
    target.hull -= damage;
  }

  if (target.hull <= 0) {
    removeUnit(targets, targetIndex);
  }
  return target;
}

/** Garde-fou : un enchaînement de tirs rapides ne dépasse jamais ce nombre (probabilité de 99,99 % déjà épuisée). */
const MAX_RAPIDFIRE_CHAIN = 200;

/**
 * Un round pour un camp : chaque unité tire une fois ; avec un tir rapide contre le type de la cible touchée
 * (n), elle rejoue avec la probabilité (n − 1) / n, tant qu'il reste des cibles.
 */
function fireRound(shooters: CombatUnit[], targets: CombatUnit[]) {
  for (let i = shooters.length - 1; i >= 0; i -= 1) {
    if (targets.length === 0) break;
    const shooter = shooters[i];
    for (let shots = 0; shots < MAX_RAPIDFIRE_CHAIN && targets.length > 0; shots += 1) {
      const target = fireAt(shooter, targets);
      const rapidfire = shooter.rapidfire?.[target.shipId] ?? 0;
      if (!(rapidfire > 1) || Math.random() >= (rapidfire - 1) / rapidfire) break;
    }
  }
}

/** Flotte d'une attaque groupée : ses vaisseaux et SES technologies (celles de son propriétaire, commandant compris). */
export interface AttackerGroup {
  key: string;
  ships: Record<number, number>;
  tech: CombatTechBonuses;
}

/** Somme de plusieurs cartes de vaisseaux (flotte groupée). */
export function mergeShipMaps(maps: ReadonlyArray<Record<number, number>>): Record<number, number> {
  const total: Record<number, number> = {};
  for (const map of maps) {
    for (const [id, count] of Object.entries(map)) {
      total[Number(id)] = (total[Number(id)] ?? 0) + Math.max(0, Math.floor(Number(count) || 0));
    }
  }
  return total;
}

export function simulateCombat(params: {
  attackerShips: Record<number, number>;
  defenderShips: Record<number, number>;
  attackerTech: CombatTechBonuses;
  defenderTech: CombatTechBonuses;
  /** Attaque groupée : chaque flotte combat avec ses propres technologies ; `attackerShips` en est la somme. */
  attackerGroups?: AttackerGroup[];
  maxRounds?: number;
}): CombatResultSummary {
  const maxRounds =
    params.maxRounds ?? GAME_CONSTANTS.MAX_COMBAT_ROUNDS ?? 6;
  const attackerUnits = params.attackerGroups
    ? params.attackerGroups.flatMap((group) => createUnits(group.ships, group.tech, group.key))
    : createUnits(params.attackerShips, params.attackerTech);
  const defenderUnits = createUnits(params.defenderShips, params.defenderTech);
  const timeline: CombatRoundSummary[] = [];

  let rounds = 0;
  let previousAttacker = countByShip(attackerUnits);
  let previousDefender = countByShip(defenderUnits);

  while (
    rounds < maxRounds &&
    attackerUnits.length > 0 &&
    defenderUnits.length > 0
  ) {
    rounds += 1;

    fireRound(attackerUnits, defenderUnits);
    fireRound(defenderUnits, attackerUnits);

    const recoverShield = (units: CombatUnit[]) => {
      units.forEach((unit) => {
        unit.shield = Math.min(
          unit.maxShield,
          unit.shield + unit.maxShield * 0.7,
        );
      });
    };

    recoverShield(attackerUnits);
    recoverShield(defenderUnits);

    const attackerRemaining = countByShip(attackerUnits);
    const defenderRemaining = countByShip(defenderUnits);
    const attackerLosses = computeLosses(previousAttacker, attackerRemaining);
    const defenderLosses = computeLosses(previousDefender, defenderRemaining);

    timeline.push({
      round: rounds,
      attackerRemaining,
      defenderRemaining,
      attackerLosses,
      defenderLosses,
    });

    previousAttacker = attackerRemaining;
    previousDefender = defenderRemaining;
  }

  const attackerRemaining = countByShip(attackerUnits);
  const defenderRemaining = countByShip(defenderUnits);
  const attackerLosses = computeLosses(params.attackerShips, attackerRemaining);
  const defenderLosses = computeLosses(params.defenderShips, defenderRemaining);

  let result: CombatResultSummary['result'] = 'draw';
  if (attackerUnits.length > 0 && defenderUnits.length === 0) {
    result = 'attacker_win';
  } else if (defenderUnits.length > 0 && attackerUnits.length === 0) {
    result = 'defender_win';
  }

  const attackerGroupsRemaining: Record<string, Record<number, number>> | undefined = params.attackerGroups
    ? Object.fromEntries(
        params.attackerGroups.map((group) => [
          group.key,
          countByShip(attackerUnits.filter((unit) => unit.group === group.key)),
        ]),
      )
    : undefined;

  return {
    rounds,
    result,
    attackerGroupsRemaining,
    attackerRemaining,
    defenderRemaining,
    attackerLosses,
    defenderLosses,
    timeline,
    debris: computeDebris(attackerLosses, defenderLosses),
  };
}

export function distributeLoot(params: {
  maxLoot: { metal: number; crystal: number; deuterium: number };
  capacity: number;
}): { metal: number; crystal: number; deuterium: number } {
  const maxLoot = {
    metal: Math.max(0, Math.floor(params.maxLoot.metal)),
    crystal: Math.max(0, Math.floor(params.maxLoot.crystal)),
    deuterium: Math.max(0, Math.floor(params.maxLoot.deuterium)),
  };

  const capacity = Math.max(0, Math.floor(params.capacity));
  const totalLootable = maxLoot.metal + maxLoot.crystal + maxLoot.deuterium;

  if (capacity === 0 || totalLootable === 0) {
    return { metal: 0, crystal: 0, deuterium: 0 };
  }

  const ratio = capacity / totalLootable;
  let metal = Math.min(maxLoot.metal, Math.floor(maxLoot.metal * ratio));
  let crystal = Math.min(maxLoot.crystal, Math.floor(maxLoot.crystal * ratio));
  let deuterium = Math.min(
    maxLoot.deuterium,
    Math.floor(maxLoot.deuterium * ratio),
  );

  let remaining = capacity - (metal + crystal + deuterium);

  const fill = (value: number, max: number) => {
    const taken = Math.min(max - value, remaining);
    remaining -= taken;
    return value + taken;
  };

  metal = fill(metal, maxLoot.metal);
  crystal = fill(crystal, maxLoot.crystal);
  deuterium = fill(deuterium, maxLoot.deuterium);

  return { metal, crystal, deuterium };
}

/**
 * Répartit une cargaison embarquée sur une capacité réduite (GAME-03).
 *
 * Si la cargaison tient dans la capacité, tout est conservé ; sinon chaque ressource est réduite
 * proportionnellement (arrondi inférieur) et le surplus est perdu avec les vaisseaux détruits.
 * Invariant : kept + lost = cargo, et somme(kept) <= capacité.
 */
export function fitCargo(
  cargo: { metal: number; crystal: number; deuterium: number },
  capacity: number,
): {
  kept: { metal: number; crystal: number; deuterium: number };
  lost: { metal: number; crystal: number; deuterium: number };
} {
  const clean = {
    metal: Math.max(0, Math.floor(cargo.metal)),
    crystal: Math.max(0, Math.floor(cargo.crystal)),
    deuterium: Math.max(0, Math.floor(cargo.deuterium)),
  };
  const total = clean.metal + clean.crystal + clean.deuterium;
  const cap = Math.max(0, Math.floor(capacity));

  if (total <= cap) {
    return { kept: clean, lost: { metal: 0, crystal: 0, deuterium: 0 } };
  }

  const ratio = cap / total;
  const kept = {
    metal: Math.floor(clean.metal * ratio),
    crystal: Math.floor(clean.crystal * ratio),
    deuterium: Math.floor(clean.deuterium * ratio),
  };
  return {
    kept,
    lost: {
      metal: clean.metal - kept.metal,
      crystal: clean.crystal - kept.crystal,
      deuterium: clean.deuterium - kept.deuterium,
    },
  };
}

export function computeCargoCapacity(
  ships: Record<number, number>,
  hyperspaceLevel: number,
): number {
  const bonus = 1 + hyperspaceLevel * 0.05;
  return Object.entries(ships).reduce((sum, [shipIdRaw, countRaw]) => {
    const shipId = Number(shipIdRaw);
    const count = Math.max(0, Math.floor(countRaw));
    const ship = SHIPS[shipId];
    if (!ship || count === 0) return sum;
    return sum + ship.cargo * bonus * count;
  }, 0);
}


/**
 * Partage d'un butin entre les flottes d'une attaque groupée, au prorata de leur place libre.
 * Aucune flotte ne dépasse sa place libre ; le reliquat des arrondis va aux flottes qui ont encore de la place.
 * Le total distribué est celui du butin dans la limite de la place libre cumulée.
 */
export function splitLoot(
  loot: { metal: number; crystal: number; deuterium: number },
  freeCapacities: readonly number[],
): Array<{ metal: number; crystal: number; deuterium: number }> {
  const frees = freeCapacities.map((free) => Math.max(0, Math.floor(free)));
  const totalFree = frees.reduce((sum, free) => sum + free, 0);
  const shares = frees.map(() => ({ metal: 0, crystal: 0, deuterium: 0 }));
  if (totalFree === 0) return shares;
  const keys = ['metal', 'crystal', 'deuterium'] as const;
  const remaining = { metal: 0, crystal: 0, deuterium: 0 };
  // Un butin supérieur à la place libre cumulée est ramené proportionnellement (ne devrait pas arriver : le butin
  // est déjà calculé pour cette capacité)
  const wanted = keys.reduce((sum, key) => sum + Math.max(0, Math.floor(loot[key])), 0);
  const scale = wanted > totalFree ? totalFree / wanted : 1;
  for (const key of keys) {
    const amount = Math.floor(Math.max(0, Math.floor(loot[key])) * scale);
    let given = 0;
    frees.forEach((free, i) => {
      const part = Math.floor((amount * free) / totalFree);
      shares[i][key] = part;
      given += part;
    });
    remaining[key] = amount - given;
  }
  const room = (i: number) => frees[i] - keys.reduce((sum, key) => sum + shares[i][key], 0);
  for (const key of keys) {
    for (let i = 0; i < shares.length && remaining[key] > 0; i += 1) {
      const add = Math.min(remaining[key], room(i));
      if (add > 0) {
        shares[i][key] += add;
        remaining[key] -= add;
      }
    }
  }
  return shares;
}
