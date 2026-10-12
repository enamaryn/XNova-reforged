import {
  FLEET_COMMANDER_MAX_LEVEL,
  combatExperience,
  commanderBonuses,
  experienceForLevel,
  experienceToLevel,
  levelFromExperience,
  skillPointsForLevel,
} from '@xnova/game-config';
import { simulateCombat } from '@xnova/game-engine';

describe('commandants de flotte : progression', () => {
  it("l'expérience par niveau suit 1000 × 1,5^(niveau − 1)", () => {
    expect(experienceToLevel(1)).toBe(1000);
    expect(experienceToLevel(2)).toBe(1500);
    expect(experienceToLevel(3)).toBe(2250);
  });

  it('niveau et expérience cumulée sont cohérents', () => {
    expect(experienceForLevel(1)).toBe(0);
    expect(experienceForLevel(2)).toBe(1000);
    expect(experienceForLevel(3)).toBe(2500);
    expect(levelFromExperience(0)).toBe(1);
    expect(levelFromExperience(999)).toBe(1);
    expect(levelFromExperience(1000)).toBe(2);
    expect(levelFromExperience(2499)).toBe(2);
    expect(levelFromExperience(2500)).toBe(3);
    expect(levelFromExperience(10 ** 12)).toBe(FLEET_COMMANDER_MAX_LEVEL);
  });

  it('un point de compétence par niveau gagné', () => {
    expect(skillPointsForLevel(1)).toBe(0);
    expect(skillPointsForLevel(5)).toBe(4);
    expect(skillPointsForLevel(99)).toBe(FLEET_COMMANDER_MAX_LEVEL - 1);
  });

  it("l'expérience d'un combat : 100 de base, 1 par 1 000 détruits, plafonnée", () => {
    expect(combatExperience(0)).toBe(100);
    expect(combatExperience(50_000)).toBe(150);
    expect(combatExperience(10 ** 12)).toBe(20_100);
    expect(combatExperience(NaN)).toBe(100);
  });

  it('chaque niveau de compétence vaut 1 %, borné à 10 %', () => {
    expect(commanderBonuses({ attack: 3, speed: 10 })).toEqual({ attack: 0.03, defense: 0, speed: 0.1, cargo: 0 });
    expect(commanderBonuses({ attack: 99, defense: -4 })).toMatchObject({ attack: 0.1, defense: 0 });
    expect(commanderBonuses(null)).toEqual({ attack: 0, defense: 0, speed: 0, cargo: 0 });
  });
});

describe('commandants de flotte : moteur de combat', () => {
  const duel = (bonus: object) =>
    simulateCombat({
      attackerShips: { 206: 6 },
      defenderShips: { 204: 60 },
      attackerTech: { weapon: 0, shield: 0, armor: 0, ...bonus },
      defenderTech: { weapon: 0, shield: 0, armor: 0 },
    });
  const defenderLosses = (bonus: object, runs: number) => {
    let total = 0;
    for (let i = 0; i < runs; i += 1) {
      total += Object.values(duel(bonus).defenderLosses ?? {}).reduce((sum, n) => sum + Number(n), 0);
    }
    return total;
  };

  it("un attaquant renforcé de 10 % (dégâts, bouclier, coque) détruit nettement plus d'unités", () => {
    // Sur 300 combats : environ 10 pertes sans bonus contre une centaine avec (marge très large)
    expect(defenderLosses({ weaponBonus: 0.1, shieldBonus: 0.1, armorBonus: 0.1 }, 300)).toBeGreaterThan(
      defenderLosses({}, 300) * 2,
    );
  });

  it("sans bonus le combat reste inchangé (aucune dérive d'arrondi)", () => {
    expect(duel({ weaponBonus: 0, shieldBonus: 0, armorBonus: 0 }).attackerRemaining).toEqual(duel({}).attackerRemaining);
  });
});
