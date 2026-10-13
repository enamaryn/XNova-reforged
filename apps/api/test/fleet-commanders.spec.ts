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
  // Duels déterministes (un seul tireur de chaque côté, un seul round, aucun tir rapide en jeu) : le bonus
  // fait basculer l'issue, sans aucun tirage au sort. Les valeurs viennent de packages/game-config.
  const duel = (attackers: Record<number, number>, defenders: Record<number, number>, bonus: object) =>
    simulateCombat({
      attackerShips: attackers,
      defenderShips: defenders,
      attackerTech: { weapon: 0, shield: 0, armor: 0, ...bonus },
      defenderTech: { weapon: 0, shield: 0, armor: 0 },
      maxRounds: 1,
    });

  it("+10 % de dégâts : un tir de 2 000 (213) ne détruit pas une défense 402 de 2 025 de bouclier et coque, un tir de 2 200 si", () => {
    expect(duel({ 213: 1 }, { 402: 1 }, {}).defenderLosses[402]).toBeUndefined();
    expect(duel({ 213: 1 }, { 402: 1 }, { weaponBonus: 0.1 }).defenderLosses[402]).toBe(1);
  });

  it("+10 % de coque : une sonde (210, 1 000 de coque) détruite par un tir de 1 000 de la 207 survit avec le bonus", () => {
    expect(duel({ 210: 1 }, { 207: 1 }, {}).attackerRemaining[210]).toBeUndefined();
    expect(duel({ 210: 1 }, { 207: 1 }, { armorBonus: 0.1 }).attackerRemaining[210]).toBe(1);
  });

  it("sans bonus (ou avec des bonus à zéro) le combat reste identique, sans dérive d'arrondi", () => {
    const base = duel({ 213: 1 }, { 402: 1 }, {});
    const zero = duel({ 213: 1 }, { 402: 1 }, { weaponBonus: 0, shieldBonus: 0, armorBonus: 0 });
    expect(zero.defenderRemaining).toEqual(base.defenderRemaining);
    expect(zero.attackerRemaining).toEqual(base.attackerRemaining);
  });
});
