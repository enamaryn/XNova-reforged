import {
  NPC_TRADE_DEFAULTS,
  dailyNoise,
  dayStart,
  effectiveSpread,
  exchangeRate,
  exchangeReceive,
  metalValue,
  npcResourceValue,
  parseNpcTradeConfig,
  readNpcTradeConfig,
  seasonOf,
  shipPriceFactor,
  shipUnitPrice,
} from '@xnova/game-config';

const config = NPC_TRADE_DEFAULTS;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('commerce PNJ - règles', () => {
  it('découpe les saisons par mois UTC', () => {
    expect(seasonOf(day('2026-12-01'))).toBe('winter');
    expect(seasonOf(day('2027-02-28'))).toBe('winter');
    expect(seasonOf(day('2026-03-01'))).toBe('spring');
    expect(seasonOf(day('2026-06-01'))).toBe('summer');
    expect(seasonOf(day('2026-09-01'))).toBe('autumn');
    expect(seasonOf(new Date('2026-11-30T23:59:59Z'))).toBe('autumn');
  });

  it('un bruit quotidien est déterministe et borné', () => {
    expect(dailyNoise('2026-10-22', 'metal')).toBe(dailyNoise('2026-10-22', 'metal'));
    const values = new Set<number>();
    for (let d = 1; d <= 60; d += 1) {
      const n = dailyNoise(`2026-10-${String(d).padStart(2, '0')}`, 'crystal');
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
      values.add(n);
    }
    expect(values.size).toBeGreaterThan(30);
  });

  it('la valeur des ressources change d’un jour à l’autre mais reste dans la variation permise', () => {
    const a = npcResourceValue('crystal', day('2026-10-22'), config);
    const b = npcResourceValue('crystal', day('2026-10-23'), config);
    expect(a).not.toBe(b);
    for (const date of ['2026-10-22', '2026-10-23', '2026-10-24']) {
      const v = npcResourceValue('crystal', day(date), config);
      expect(v).toBeGreaterThanOrEqual(1.5 * (1 - config.dailyVariation));
      expect(v).toBeLessThanOrEqual(1.5 * (1 + config.dailyVariation));
    }
  });

  it('la saison modifie la valeur d’une ressource et la marge', () => {
    const noVariation = { ...config, dailyVariation: 0 };
    expect(npcResourceValue('deuterium', day('2026-01-10'), noVariation)).toBeCloseTo(3 * 1.15, 10);
    expect(npcResourceValue('deuterium', day('2026-07-10'), noVariation)).toBeCloseTo(3 * 0.9, 10);
    expect(effectiveSpread(config, day('2026-04-10'))).toBeCloseTo(0.15 * 0.75, 10);
    expect(effectiveSpread(config, day('2026-07-10'))).toBeCloseTo(0.15, 10);
  });

  it('un événement du monde réduit encore la marge, bornée à zéro', () => {
    expect(effectiveSpread(config, day('2026-07-10'), 0.5)).toBeCloseTo(0.075, 10);
    expect(effectiveSpread(config, day('2026-07-10'), 5)).toBe(0);
    expect(effectiveSpread(config, day('2026-07-10'), -1)).toBeCloseTo(0.15, 10);
  });

  it('un aller-retour chez le marchand fait toujours perdre le joueur', () => {
    const date = day('2026-10-22');
    for (const [a, b] of [
      ['metal', 'crystal'],
      ['crystal', 'deuterium'],
      ['deuterium', 'metal'],
    ] as const) {
      const there = exchangeReceive(a, b, 100_000, date, config);
      const back = exchangeReceive(b, a, there, date, config);
      expect(back).toBeLessThan(100_000);
    }
  });

  it('arrondit toujours la quantité reçue vers le bas', () => {
    const date = day('2026-10-22');
    const rate = exchangeRate('metal', 'crystal', date, config);
    expect(exchangeReceive('metal', 'crystal', 7, date, config)).toBe(Math.floor(7 * rate));
  });

  it('le prix d’un vaisseau suit le multiplicateur, la saison et le jour', () => {
    const base = { metal: 2000, crystal: 2000, deuterium: 0 };
    const noVariation = { ...config, dailyVariation: 0 };
    const summer = shipUnitPrice(base, day('2026-07-10'), noVariation);
    const spring = shipUnitPrice(base, day('2026-04-10'), noVariation);
    expect(summer.metal).toBe(Math.ceil(2000 * 1.5 * 0.9));
    expect(spring.metal).toBe(3000);
    expect(summer.deuterium).toBe(0);
    expect(shipPriceFactor(day('2026-10-22'), config)).not.toBe(shipPriceFactor(day('2026-10-23'), config));
  });

  it('calcule la valeur équivalent métal et le début de jour UTC', () => {
    expect(metalValue({ metal: 10, crystal: 10, deuterium: 10 })).toBe(10 + 15 + 30);
    expect(dayStart(new Date('2026-10-22T23:59:59Z')).toISOString()).toBe('2026-10-22T00:00:00.000Z');
  });
});

describe('commerce PNJ - réglages admin', () => {
  it('accepte les valeurs par défaut', () => {
    const parsed = parseNpcTradeConfig(JSON.parse(JSON.stringify(config)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok === true) expect(parsed.config).toEqual(config);
  });

  it('refuse sans rien corriger en silence', () => {
    const bad = (patch: Record<string, unknown>) => parseNpcTradeConfig({ ...JSON.parse(JSON.stringify(config)), ...patch });
    expect(bad({ spread: 0.9 }).ok).toBe(false);
    expect(bad({ spread: '0.1' }).ok).toBe(false);
    expect(bad({ enabled: 'oui' }).ok).toBe(false);
    expect(bad({ exchangeDailyCap: -1 }).ok).toBe(false);
    expect(bad({ shipPriceMultiplier: 0 }).ok).toBe(false);
    expect(bad({ ships: [212] }).ok).toBe(false); // satellite solaire non vendable
    expect(bad({ ships: [9999] }).ok).toBe(false);
    expect(bad({ ships: [202, 202] }).ok).toBe(false);
    expect(bad({ ships: 'tous' }).ok).toBe(false);
    expect(parseNpcTradeConfig({}).ok).toBe(false);
    expect(parseNpcTradeConfig(null).ok).toBe(false);
    const seasons = JSON.parse(JSON.stringify(config.seasons));
    seasons.winter.values.metal = 10;
    expect(bad({ seasons }).ok).toBe(false);
  });

  it('relit un réglage stocké : défaut si absent ou corrompu, valeurs invalides ramenées au défaut ou aux bornes', () => {
    expect(readNpcTradeConfig(null)).toEqual(config);
    expect(readNpcTradeConfig('pas du json')).toEqual(config);
    const partial = readNpcTradeConfig(JSON.stringify({ spread: 0.2, ships: [202, 212, 9999], dailyVariation: 'x', shipDailyCap: 5 }));
    expect(partial.spread).toBe(0.2);
    expect(partial.ships).toEqual([202]);
    expect(partial.dailyVariation).toBe(config.dailyVariation);
    expect(partial.shipDailyCap).toBe(5);
    expect(partial.seasons).toEqual(config.seasons);
    expect(readNpcTradeConfig(JSON.stringify({ spread: 7 })).spread).toBe(0.5);
  });
});
