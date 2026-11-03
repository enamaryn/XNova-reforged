import {
  INVASION_DEFAULTS,
  INVASION_LIMITS,
  fleetValue,
  invasionDeadline,
  invasionExpired,
  nextAutoInvasionAt,
  parseInvasionConfig,
  readInvasionConfig,
  waveFleet,
  waveValue,
} from '@xnova/game-config';

describe('invasions aliens — règles pures', () => {
  describe('waveFleet / waveValue', () => {
    it('la première vague est la flotte de base', () => {
      expect(waveFleet({ 204: 400, 207: 15 }, 1.35, 1)).toEqual({ 204: 400, 207: 15 });
    });

    it('chaque vague multiplie les effectifs par le facteur, arrondi à l’entier inférieur', () => {
      expect(waveFleet({ 204: 400, 207: 15 }, 2, 3)).toEqual({ 204: 1600, 207: 60 });
      expect(waveFleet({ 204: 400, 207: 15 }, 1.35, 2)).toEqual({ 204: 540, 207: 20 });
    });

    it('garde au moins un vaisseau par type et ignore les effectifs nuls', () => {
      expect(waveFleet({ 204: 1, 207: 0 }, 1, 5)).toEqual({ 204: 1 });
      expect(waveFleet({ 204: 1 }, 3, 1)).toEqual({ 204: 1 });
    });

    it('un facteur inférieur à 1 est ramené à 1 (jamais de vague plus faible)', () => {
      expect(waveFleet({ 204: 100 }, 0.5, 4)).toEqual({ 204: 100 });
    });

    it('la valeur des vagues par défaut croît à chaque vague', () => {
      const values = [1, 2, 3, 4, 5].map((index) => waveValue(INVASION_DEFAULTS.waveShips, INVASION_DEFAULTS.waveGrowth, index));
      for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThan(values[i - 1]);
      expect(values[0]).toBe(fleetValue(INVASION_DEFAULTS.waveShips));
    });
  });

  describe('échéance et lancement automatique', () => {
    const start = new Date('2026-11-04T12:00:00Z');

    it('l’échéance est la durée après le début ; atteinte à l’instant exact', () => {
      const end = invasionDeadline(start, 72);
      expect(end.toISOString()).toBe('2026-11-07T12:00:00.000Z');
      expect(invasionExpired(end, new Date(end.getTime() - 1))).toBe(false);
      expect(invasionExpired(end, end)).toBe(true);
    });

    it('lancement automatique : jamais à 0, tout de suite sans invasion précédente, sinon après l’intervalle', () => {
      expect(nextAutoInvasionAt(null, 0)).toBeNull();
      expect(nextAutoInvasionAt(start, 0)).toBeNull();
      expect(nextAutoInvasionAt(null, 3)!.getTime()).toBe(0);
      expect(nextAutoInvasionAt(start, 3)!.toISOString()).toBe('2026-11-07T12:00:00.000Z');
    });
  });

  describe('parseInvasionConfig (strict)', () => {
    it('accepte les valeurs par défaut', () => {
      const parsed = parseInvasionConfig(INVASION_DEFAULTS);
      expect(parsed).toEqual({ ok: true, config: INVASION_DEFAULTS });
    });

    it('refuse sans rien corriger : bornes, vaisseaux, booléen, butins', () => {
      const parsed = parseInvasionConfig({
        ...INVASION_DEFAULTS,
        enabled: 'oui',
        waves: 0,
        durationHours: 1000,
        waveGrowth: INVASION_LIMITS.waveGrowth.max + 1,
        waveShips: { 212: 5, 9999: 1 },
        tech: { weapon: -1, shield: 3, armor: 3.5 },
        waveLoot: { metal: -1, crystal: 0, deuterium: 0 },
        rewardDays: 0,
      });
      expect(parsed.ok).toBe(false);
      const errors = (parsed as { errors: string[] }).errors.join(' | ');
      for (const field of ['enabled', 'waves', 'durationHours', 'waveGrowth', 'waveShips', 'tech.weapon', 'tech.armor', 'waveLoot.metal', 'rewardDays']) {
        expect(errors).toContain(field);
      }
    });

    it('exige une flotte non vide et refuse un corps qui n’est pas un objet', () => {
      expect(parseInvasionConfig({ ...INVASION_DEFAULTS, waveShips: {} }).ok).toBe(false);
      expect(parseInvasionConfig(null).ok).toBe(false);
      expect(parseInvasionConfig('x').ok).toBe(false);
    });
  });

  describe('readInvasionConfig (tolérant)', () => {
    it('valeur absente ou illisible : défauts', () => {
      expect(readInvasionConfig(undefined)).toEqual(INVASION_DEFAULTS);
      expect(readInvasionConfig('{pas du json')).toEqual(INVASION_DEFAULTS);
    });

    it('remplace chaque champ invalide par son défaut et borne les valeurs', () => {
      const config = readInvasionConfig(JSON.stringify({ enabled: true, waves: 999, waveGrowth: 'x', waveShips: { 212: 3 }, tech: { weapon: 99 }, rewardDays: -5 }));
      expect(config.enabled).toBe(true);
      expect(config.waves).toBe(INVASION_LIMITS.waves.max);
      expect(config.waveGrowth).toBe(INVASION_DEFAULTS.waveGrowth);
      expect(config.waveShips).toEqual(INVASION_DEFAULTS.waveShips);
      expect(config.tech.weapon).toBe(INVASION_LIMITS.tech.max);
      expect(config.rewardDays).toBe(INVASION_LIMITS.rewardDays.min);
    });
  });
});
