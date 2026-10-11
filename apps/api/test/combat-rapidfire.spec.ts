import { simulateCombat } from '@xnova/game-engine';

// Chasseur léger (204) : tir rapide ×10 contre le lanceur de missiles (401), ×5 contre la sonde (210)
const LIGHT_FIGHTER = 204;
const LAUNCHER = 401;
const LIGHT_LASER = 402; // aucun tir rapide du chasseur léger contre lui

// Technologie militaire 100 : l'arme du chasseur léger (60) passe à 660, un tir détruit un lanceur (coque 200)
const strong = { weapon: 100, shield: 0, armor: 0 };
const none = { weapon: 0, shield: 0, armor: 0 };

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('Combat — tir rapide', () => {
  afterEach(() => jest.restoreAllMocks());

  const fight = (target: number, count: number) =>
    simulateCombat({
      attackerShips: { [LIGHT_FIGHTER]: 1 },
      defenderShips: { [target]: count },
      attackerTech: strong,
      defenderTech: none,
      maxRounds: 1,
    });

  it('enchaîne les tirs tant que le tir rapide se déclenche (tous les jets favorables)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // cible n°0, et jet de tir rapide toujours favorable
    const result = fight(LAUNCHER, 5);
    expect(result.defenderLosses[LAUNCHER]).toBe(5);
    expect(result.result).toBe('attacker_win');
  });

  it('un seul tir quand le jet de tir rapide échoue', () => {
    const rolls = [0, 0.99]; // cible, puis jet raté, en boucle
    let n = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => rolls[n++ % rolls.length]);
    const result = fight(LAUNCHER, 5);
    expect(result.defenderLosses[LAUNCHER]).toBe(1);
  });

  it("n'enchaîne pas contre un type absent de la table de tir rapide", () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = fight(LIGHT_LASER, 5);
    // Un seul tir (arme 660 contre coque 2 000 : la cible survit) et aucun enchaînement
    expect(result.defenderLosses[LIGHT_LASER] ?? 0).toBe(0);
  });

  it('nombre moyen de tirs : un chasseur léger détruit en moyenne 10 lanceurs par round (tir rapide ×10)', () => {
    const random = mulberry32(42);
    jest.spyOn(Math, 'random').mockImplementation(random);
    const trials = 600;
    let killed = 0;
    for (let i = 0; i < trials; i += 1) {
      killed += fight(LAUNCHER, 1000).defenderLosses[LAUNCHER] ?? 0;
    }
    const mean = killed / trials;
    expect(mean).toBeGreaterThan(8.5);
    expect(mean).toBeLessThan(11.5);
  });

  it('le tir rapide ne dépasse jamais le nombre de cibles et le combat se termine', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = simulateCombat({
      attackerShips: { [LIGHT_FIGHTER]: 50 },
      defenderShips: { [LAUNCHER]: 20 },
      attackerTech: strong,
      defenderTech: none,
    });
    expect(result.rounds).toBe(1);
    expect(result.defenderRemaining[LAUNCHER] ?? 0).toBe(0);
  });

  it('un camp défenseur peut aussi bénéficier du tir rapide (flotte stationnée)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = simulateCombat({
      attackerShips: { [LAUNCHER]: 5 },
      defenderShips: { [LIGHT_FIGHTER]: 1 },
      attackerTech: none,
      defenderTech: strong,
      maxRounds: 1,
    });
    // Le défenseur tire après l'attaquant ; ses tirs enchaînés détruisent les 5 lanceurs
    expect(result.attackerLosses[LAUNCHER]).toBe(5);
  });
});
