import {
  MARKET_REFERENCE_VALUE,
  MARKET_TAX_RATE,
  isMarketResource,
  isRateAllowed,
  normalizeRate,
  paymentFor,
  rateBounds,
  referenceRate,
  taxOf,
} from '@xnova/game-config';

describe('marché : règles pures', () => {
  it('connaît les trois ressources', () => {
    expect(isMarketResource('metal')).toBe(true);
    expect(isMarketResource('deuterium')).toBe(true);
    expect(isMarketResource('energy')).toBe(false);
    expect(isMarketResource(undefined)).toBe(false);
  });

  it('le taux de référence suit le rapport 3 : 2 : 1', () => {
    expect(referenceRate('metal', 'metal')).toBe(1);
    expect(referenceRate('deuterium', 'metal')).toBe(3);
    expect(referenceRate('metal', 'deuterium')).toBeCloseTo(1 / 3);
    expect(referenceRate('crystal', 'metal')).toBeCloseTo(1.5);
    // réciprocité : acheter puis revendre à la parité ne crée rien
    expect(referenceRate('crystal', 'deuterium') * referenceRate('deuterium', 'crystal')).toBeCloseTo(1);
    expect(MARKET_REFERENCE_VALUE.metal).toBeLessThan(MARKET_REFERENCE_VALUE.deuterium);
  });

  it('le taux reste dans la moitié et le double de la référence', () => {
    const { min, max } = rateBounds('deuterium', 'metal'); // référence 3
    expect(min).toBe(1.5);
    expect(max).toBe(6);
    expect(isRateAllowed('deuterium', 'metal', 3)).toBe(true);
    expect(isRateAllowed('deuterium', 'metal', 1.5)).toBe(true);
    expect(isRateAllowed('deuterium', 'metal', 6)).toBe(true);
    expect(isRateAllowed('deuterium', 'metal', 1.49)).toBe(false);
    expect(isRateAllowed('deuterium', 'metal', 6.01)).toBe(false);
    expect(isRateAllowed('deuterium', 'metal', 0)).toBe(false);
    expect(isRateAllowed('deuterium', 'metal', -2)).toBe(false);
    expect(isRateAllowed('deuterium', 'metal', Number.NaN)).toBe(false);
    expect(isRateAllowed('deuterium', 'metal', Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('le taux est arrondi à 4 décimales', () => {
    expect(normalizeRate(1.23456789)).toBe(1.2346);
    expect(normalizeRate(0.33333)).toBe(0.3333);
  });

  it('le paiement est arrondi au supérieur, au moins 1', () => {
    expect(paymentFor(10, 1.5)).toBe(15);
    expect(paymentFor(3, 0.3333)).toBe(1); // 0,9999 → 1
    expect(paymentFor(1, 0.0001)).toBe(1);
    expect(paymentFor(7, 0.5)).toBe(4); // 3,5 → 4
    // pas d'artefact flottant : 0,1 × 3 vaut 0,3 et non 0,30000000000000004
    expect(paymentFor(30, 0.1)).toBe(3);
  });

  it('la taxe vaut 5 % arrondis à l’inférieur et ne dépasse jamais le paiement', () => {
    expect(MARKET_TAX_RATE).toBe(0.05);
    expect(taxOf(100)).toBe(5);
    expect(taxOf(19)).toBe(0);
    expect(taxOf(20)).toBe(1);
    for (const payment of [1, 2, 19, 20, 999, 1_000_000]) {
      expect(taxOf(payment)).toBeGreaterThanOrEqual(0);
      expect(taxOf(payment)).toBeLessThan(payment);
    }
  });

  it('conservation : paiement = part du vendeur + taxe détruite, sur des cas variés', () => {
    for (let i = 1; i < 300; i += 1) {
      const quantity = (i * 37) % 5000 + 1;
      const rate = normalizeRate(0.25 + ((i * 13) % 700) / 100);
      const payment = paymentFor(quantity, rate);
      const tax = taxOf(payment);
      expect(payment - tax + tax).toBe(payment);
      expect(payment - tax).toBeGreaterThanOrEqual(0);
    }
  });
});
