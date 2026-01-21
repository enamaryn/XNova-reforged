import { GAME_CONSTANTS, SHIPS } from '@xnova/game-config';

export interface CombatTechBonuses {
  weapon: number;
  shield: number;
  armor: number;
}

export interface CombatResultSummary {
  rounds: number;
  result: 'attacker_win' | 'defender_win' | 'draw';
  attackerRemaining: Record<number, number>;
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
  shipId: number;
  hull: number;
  shield: number;
  weapon: number;
  maxHull: number;
  maxShield: number;
}

function applyTech(value: number, level: number): number {
  return Math.floor(value * (1 + level * 0.1));
}

function createUnits(
  ships: Record<number, number>,
  tech: CombatTechBonuses,
): CombatUnit[] {
  const units: CombatUnit[] = [];

  Object.entries(ships).forEach(([shipIdRaw, countRaw]) => {
    const shipId = Number(shipIdRaw);
    const count = Math.max(0, Math.floor(countRaw));
    const ship = SHIPS[shipId];
    if (!ship || count === 0) return;

    const baseHull = applyTech(ship.stats.hull, tech.armor);
    const baseShield = applyTech(ship.stats.shield, tech.shield);
    const baseWeapon = applyTech(ship.stats.weapon, tech.weapon);

    for (let i = 0; i < count; i += 1) {
      units.push({
        shipId,
        hull: baseHull,
        shield: baseShield,
        weapon: baseWeapon,
        maxHull: baseHull,
        maxShield: baseShield,
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

export function simulateCombat(params: {
  attackerShips: Record<number, number>;
  defenderShips: Record<number, number>;
  attackerTech: CombatTechBonuses;
  defenderTech: CombatTechBonuses;
  maxRounds?: number;
}): CombatResultSummary {
  const maxRounds =
    params.maxRounds ?? GAME_CONSTANTS.MAX_COMBAT_ROUNDS ?? 6;
  const attackerUnits = createUnits(params.attackerShips, params.attackerTech);
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

    for (let i = attackerUnits.length - 1; i >= 0; i -= 1) {
      if (defenderUnits.length === 0) break;
      const attacker = attackerUnits[i];
      const targetIndex = Math.floor(Math.random() * defenderUnits.length);
      const target = defenderUnits[targetIndex];

      let damage = attacker.weapon;
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
        removeUnit(defenderUnits, targetIndex);
      }
    }

    for (let i = defenderUnits.length - 1; i >= 0; i -= 1) {
      if (attackerUnits.length === 0) break;
      const defender = defenderUnits[i];
      const targetIndex = Math.floor(Math.random() * attackerUnits.length);
      const target = attackerUnits[targetIndex];

      let damage = defender.weapon;
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
        removeUnit(attackerUnits, targetIndex);
      }
    }

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

  return {
    rounds,
    result,
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

  let capacity = Math.max(0, Math.floor(params.capacity));
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
