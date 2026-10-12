import {
  EXPEDITION_OUTCOME_WEIGHTS,
  expeditionDelayFactor,
  expeditionPirateLossFraction,
  expeditionResourceFind,
  expeditionShipFind,
  expeditionSpeedupFactor,
  maxExpeditions,
  pickExpeditionOutcome,
} from '@xnova/game-config';

describe('expéditions : règles pures', () => {
  it('nombre d\'expéditions simultanées : racine entière du niveau', () => {
    expect([0, 1, 3, 4, 8, 9, 16].map(maxExpeditions)).toEqual([0, 1, 1, 2, 2, 3, 4]);
  });

  it('les poids font 1000 et chaque issue est atteignable aux bornes', () => {
    expect(EXPEDITION_OUTCOME_WEIGHTS.reduce((s, e) => s + e.weight, 0)).toBe(1000);
    expect(pickExpeditionOutcome(0)).toBe('nothing');
    expect(pickExpeditionOutcome(0.299)).toBe('nothing');
    expect(pickExpeditionOutcome(0.3)).toBe('resources');
    expect(pickExpeditionOutcome(0.6)).toBe('ships');
    expect(pickExpeditionOutcome(0.69)).toBe('delay');
    expect(pickExpeditionOutcome(0.79)).toBe('speedup');
    expect(pickExpeditionOutcome(0.84)).toBe('pirates');
    expect(pickExpeditionOutcome(0.99)).toBe('blackhole');
    expect(pickExpeditionOutcome(1)).toBe('blackhole');
    expect(pickExpeditionOutcome(-3)).toBe('nothing');
  });

  it('fréquences conformes aux poids sur un balayage régulier', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i += 1) {
      const outcome = pickExpeditionOutcome(i / 1000);
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    }
    for (const { outcome, weight } of EXPEDITION_OUTCOME_WEIGHTS) expect(counts[outcome]).toBe(weight);
  });

  it('ressources : part de la capacité, bornée par la place libre, type selon le tirage', () => {
    const base = { capacity: 100000, usedCargo: 0, techLevel: 0, amountRoll: 0.5 };
    expect(expeditionResourceFind({ ...base, typeRoll: 0.1 })).toEqual({ resource: 'metal', amount: 20000 });
    expect(expeditionResourceFind({ ...base, typeRoll: 0.6 })).toEqual({ resource: 'crystal', amount: 20000 });
    expect(expeditionResourceFind({ ...base, typeRoll: 0.9 })).toEqual({ resource: 'deuterium', amount: 10000 });
    expect(expeditionResourceFind({ ...base, typeRoll: 0.1, techLevel: 5 }).amount).toBe(30000);
    expect(expeditionResourceFind({ ...base, typeRoll: 0.1, usedCargo: 95000 }).amount).toBe(5000);
    expect(expeditionResourceFind({ ...base, typeRoll: 0.1, usedCargo: 100000 }).amount).toBe(0);
  });

  it('vaisseaux trouvés : 1 à 10, jusqu\'à 10 % de la flotte', () => {
    expect(expeditionShipFind({ fleetSize: 5, amountRoll: 1, typeRoll: 0 })).toEqual({ shipId: 202, amount: 1 });
    expect(expeditionShipFind({ fleetSize: 50, amountRoll: 1, typeRoll: 0.5 })).toEqual({ shipId: 204, amount: 5 });
    expect(expeditionShipFind({ fleetSize: 5000, amountRoll: 1, typeRoll: 0.99 })).toEqual({ shipId: 210, amount: 10 });
    expect(expeditionShipFind({ fleetSize: 0, amountRoll: 0, typeRoll: 0 }).amount).toBe(1);
  });

  it('retard, avance et pertes dans leurs bornes', () => {
    expect(expeditionDelayFactor(0)).toBe(1.5);
    expect(expeditionDelayFactor(1)).toBe(3);
    expect(expeditionSpeedupFactor(0)).toBe(0.8);
    expect(expeditionSpeedupFactor(1)).toBeCloseTo(0.5);
    expect(expeditionPirateLossFraction(0)).toBeCloseTo(0.1);
    expect(expeditionPirateLossFraction(1)).toBeCloseTo(0.3);
  });
});
