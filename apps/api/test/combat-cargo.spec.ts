import {
  computeCargoCapacity,
  distributeLoot,
  fitCargo,
  simulateCombat,
} from '@xnova/game-engine';

/**
 * GAME-03 — moteur réel (aucun mock) : conservation de la cargaison embarquée et butin borné
 * par la capacité libre.
 */
describe('Moteur de combat réel — cargaison (GAME-03)', () => {
  describe('fitCargo', () => {
    it('conserve tout si la cargaison tient dans la capacité', () => {
      const result = fitCargo({ metal: 100, crystal: 50, deuterium: 0 }, 150);
      expect(result.kept).toEqual({ metal: 100, crystal: 50, deuterium: 0 });
      expect(result.lost).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    });

    it('réduit proportionnellement et perd le surplus', () => {
      const result = fitCargo({ metal: 600, crystal: 300, deuterium: 100 }, 500);
      expect(result.kept).toEqual({ metal: 300, crystal: 150, deuterium: 50 });
      expect(result.lost).toEqual({ metal: 300, crystal: 150, deuterium: 50 });
    });

    it('perd tout sans capacité', () => {
      const result = fitCargo({ metal: 10, crystal: 10, deuterium: 10 }, 0);
      expect(result.kept).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
      expect(result.lost).toEqual({ metal: 10, crystal: 10, deuterium: 10 });
    });

    it.each([
      [{ metal: 1, crystal: 1, deuterium: 1 }, 2],
      [{ metal: 999, crystal: 7, deuterium: 3 }, 500],
      [{ metal: 0, crystal: 0, deuterium: 12345 }, 1],
      [{ metal: 33, crystal: 33, deuterium: 33 }, 98],
    ])('invariants (kept + lost = cargo, kept <= capacité) pour %j / %p', (cargo, capacity) => {
      const { kept, lost } = fitCargo(cargo, capacity);
      expect(kept.metal + lost.metal).toBe(cargo.metal);
      expect(kept.crystal + lost.crystal).toBe(cargo.crystal);
      expect(kept.deuterium + lost.deuterium).toBe(cargo.deuterium);
      expect(kept.metal + kept.crystal + kept.deuterium).toBeLessThanOrEqual(capacity);
    });
  });

  describe('combat simulé avec le vrai moteur', () => {
    const tech = { weapon: 0, shield: 0, armor: 0 };

    it('victoire écrasante : survivants, capacité réelle et butin borné par la place libre', () => {
      const result = simulateCombat({
        attackerShips: { 206: 40, 202: 20 }, // croiseurs et petits transporteurs
        defenderShips: {},
        attackerTech: tech,
        defenderTech: tech,
      });
      expect(result.result).toBe('attacker_win');
      expect(result.attackerRemaining).toEqual({ 206: 40, 202: 20 });

      const capacity = computeCargoCapacity(result.attackerRemaining, 0);
      const boarded = { metal: capacity - 1000, crystal: 0, deuterium: 0 };
      const { kept } = fitCargo(boarded, capacity);
      const free = capacity - (kept.metal + kept.crystal + kept.deuterium);
      const loot = distributeLoot({
        maxLoot: { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000 },
        capacity: free,
      });

      expect(free).toBe(1000);
      expect(loot.metal + loot.crystal + loot.deuterium).toBeLessThanOrEqual(1000);
      expect(kept.metal + loot.metal + loot.crystal + loot.deuterium).toBeLessThanOrEqual(capacity);
    });

    it('défaite écrasante : plus de survivants, donc plus de capacité ni de cargaison', () => {
      const result = simulateCombat({
        attackerShips: { 202: 1 },
        defenderShips: { 207: 200 }, // 200 vaisseaux de bataille
        attackerTech: tech,
        defenderTech: tech,
      });
      expect(result.result).toBe('defender_win');
      expect(computeCargoCapacity(result.attackerRemaining, 0)).toBe(0);
      const { kept, lost } = fitCargo(
        { metal: 5000, crystal: 0, deuterium: 0 },
        computeCargoCapacity(result.attackerRemaining, 0),
      );
      expect(kept.metal).toBe(0);
      expect(lost.metal).toBe(5000);
    });
  });
});
