import {
  BOSS_DEFAULTS,
  SHIPS,
  bossHealthRatio,
  bossIntercepts,
  bossRespawnAt,
  fleetValue,
  parseBossConfig,
  readBossConfig,
  regenerateBossFleet,
  shipTotal,
  splitBossLoot,
} from '@xnova/game-config';

describe('boss galactiques - règles', () => {
  it('compte les vaisseaux et la valeur d’une flotte (coût du chantier spatial en équivalent métal)', () => {
    expect(shipTotal({ 204: 5, 206: 3 })).toBe(8);
    expect(shipTotal({})).toBe(0);
    const cost = SHIPS[204].cost;
    expect(fleetValue({ 204: 2 })).toBe(2 * (cost.metal + cost.crystal * 1.5 + cost.deuterium * 3));
    expect(fleetValue({ 999: 10 })).toBe(0);
  });

  it('calcule la santé comme la part de valeur restante, bornée à 1', () => {
    const max = { 204: 100 };
    expect(bossHealthRatio({ 204: 100 }, max)).toBe(1);
    expect(bossHealthRatio({ 204: 25 }, max)).toBeCloseTo(0.25, 10);
    expect(bossHealthRatio({}, max)).toBe(0);
    expect(bossHealthRatio({ 204: 500 }, max)).toBe(1);
    expect(bossHealthRatio({ 204: 1 }, {})).toBe(0);
  });

  it('régénère chaque type vers son maximum, jamais au-delà, et ramène un type détruit', () => {
    const max = { 204: 1000, 206: 100 };
    expect(regenerateBossFleet({ 204: 500, 206: 0 }, max, 5, 2)).toEqual({ 204: 600, 206: 10 });
    expect(regenerateBossFleet({ 204: 990 }, max, 10, 5)).toEqual({ 204: 1000, 206: 50 });
    expect(regenerateBossFleet({ 204: 500 }, max, 0, 2)).toEqual({ 204: 500 });
    expect(regenerateBossFleet({ 204: 500 }, max, 10, 0)).toEqual({ 204: 500 });
    expect(regenerateBossFleet({ 204: 500 }, max, -3, 2)).toEqual({ 204: 500 });
  });

  it('planifie la réapparition et décide de l’interception', () => {
    expect(bossRespawnAt(new Date('2026-10-26T12:00:00Z'), 7).toISOString()).toBe('2026-11-02T12:00:00.000Z');
    expect(bossIntercepts(0.49, 0.5)).toBe(true);
    expect(bossIntercepts(0.5, 0.5)).toBe(false);
    expect(bossIntercepts(0, 0)).toBe(false);
    expect(bossIntercepts(0.99, 1)).toBe(true);
  });

  it('partage le butin au prorata des dégâts, sans jamais dépasser le butin', () => {
    const loot = { metal: 1000, crystal: 333, deuterium: 7 };
    const shares = splitBossLoot(loot, [
      { key: 'a', damage: 75 },
      { key: 'b', damage: 25 },
      { key: 'c', damage: 0 },
    ]);
    expect(shares.a).toEqual({ metal: 750, crystal: 249, deuterium: 5 });
    expect(shares.b).toEqual({ metal: 250, crystal: 83, deuterium: 1 });
    expect(shares.c).toBeUndefined();
    for (const resource of ['metal', 'crystal', 'deuterium'] as const) {
      expect(shares.a[resource] + shares.b[resource]).toBeLessThanOrEqual(loot[resource]);
    }
    expect(splitBossLoot(loot, [])).toEqual({});
    expect(splitBossLoot(loot, [{ key: 'a', damage: -5 }])).toEqual({});
  });
});

describe('boss galactiques - réglages admin', () => {
  const valid = () => JSON.parse(JSON.stringify(BOSS_DEFAULTS));

  it('accepte les valeurs par défaut (boss désactivé par défaut)', () => {
    expect(BOSS_DEFAULTS.enabled).toBe(false);
    const parsed = parseBossConfig(valid());
    expect(parsed.ok).toBe(true);
    if (parsed.ok === true) expect(parsed.config).toEqual(BOSS_DEFAULTS);
  });

  it('refuse sans rien corriger en silence', () => {
    const bad = (patch: Record<string, unknown>) => parseBossConfig({ ...valid(), ...patch });
    expect(bad({ enabled: 'oui' }).ok).toBe(false);
    expect(bad({ respawnDays: 0 }).ok).toBe(false);
    expect(bad({ respawnDays: 7.5 }).ok).toBe(false);
    expect(bad({ aggroChance: 1.5 }).ok).toBe(false);
    expect(bad({ regenPercentPerHour: -1 }).ok).toBe(false);
    expect(bad({ ships: {} }).ok).toBe(false);
    expect(bad({ ships: { 212: 10 } }).ok).toBe(false); // satellite solaire
    expect(bad({ ships: { 9999: 10 } }).ok).toBe(false);
    expect(bad({ ships: { 204: 0 } }).ok).toBe(false);
    expect(bad({ ships: { 204: 1.5 } }).ok).toBe(false);
    expect(bad({ tech: { weapon: 99, shield: 1, armor: 1 } }).ok).toBe(false);
    expect(bad({ loot: { metal: -1, crystal: 0, deuterium: 0 } }).ok).toBe(false);
    expect(parseBossConfig(null).ok).toBe(false);
  });

  it('relit un réglage stocké : défaut si absent ou corrompu, valeurs invalides ramenées au défaut ou aux bornes', () => {
    expect(readBossConfig(null)).toEqual(BOSS_DEFAULTS);
    expect(readBossConfig('pas du json')).toEqual(BOSS_DEFAULTS);
    expect(readBossConfig('[]')).toEqual(BOSS_DEFAULTS);
    const partial = readBossConfig(JSON.stringify({ enabled: true, respawnDays: 500, ships: { 204: 10, 212: 5, 9999: 1 }, aggroChance: 'x' }));
    expect(partial.enabled).toBe(true);
    expect(partial.respawnDays).toBe(60);
    expect(partial.ships).toEqual({ 204: 10 });
    expect(partial.aggroChance).toBe(BOSS_DEFAULTS.aggroChance);
    expect(readBossConfig(JSON.stringify({ ships: { 9999: 1 } })).ships).toEqual(BOSS_DEFAULTS.ships);
  });
});
