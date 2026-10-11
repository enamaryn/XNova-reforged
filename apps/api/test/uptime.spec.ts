import { computeUptime } from '../src/supervision/uptime';

const MIN = 60_000;
const t0 = Date.UTC(2026, 9, 12, 10, 0, 0);
const at = (minute: number) => new Date(t0 + minute * MIN);
const run = (from: number, to: number, status = 'healthy') =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ at: at(from + i), status }));

describe('Disponibilité (computeUptime)', () => {
  it('aucune mesure : aucun pourcentage inventé', () => {
    const r = computeUptime([], 86_400_000, at(100), null);
    expect(r).toMatchObject({ availablePercent: null, healthyPercent: null, measuredSince: null, windowMinutes: 0 });
  });

  it('ne compte pas le temps antérieur à la première mesure', () => {
    // 60 minutes mesurées sur une fenêtre de 30 jours : 100 %, pas 0,1 %
    const r = computeUptime(run(0, 59), 30 * 86_400_000, at(60), at(0));
    expect(r.windowMinutes).toBe(60);
    expect(r.availablePercent).toBe(100);
    expect(r.outages).toBe(0);
  });

  it('une minute sans échantillon est une indisponibilité, groupée en une seule panne', () => {
    const samples = [...run(0, 9), ...run(15, 19)]; // trous : minutes 10 à 14
    const r = computeUptime(samples, 86_400_000, at(20), at(0));
    expect(r.windowMinutes).toBe(20);
    expect(r.downMinutes).toBe(5);
    expect(r.availablePercent).toBe(75);
    expect(r.outages).toBe(1);
  });

  it('« dégradé » reste disponible ; « indisponible » ne l\'est pas ; deux pannes distinctes', () => {
    const samples = [...run(0, 3, 'healthy'), ...run(4, 5, 'degraded'), ...run(6, 7, 'unavailable'), ...run(8, 9, 'healthy'), ...run(10, 10, 'unavailable'), ...run(11, 19, 'healthy')];
    const r = computeUptime(samples, 86_400_000, at(20), at(0));
    expect(r.windowMinutes).toBe(20);
    expect(r.availablePercent).toBe(85); // 3 minutes indisponibles sur 20
    expect(r.healthyPercent).toBe(75); // 15 sur 20 (2 dégradées + 3 indisponibles)
    expect(r.outages).toBe(2);
  });

  it('la minute en cours n\'est comptée qu\'une fois terminée', () => {
    const r = computeUptime(run(0, 4), 86_400_000, new Date(t0 + 5 * MIN + 30_000), at(0));
    expect(r.windowMinutes).toBe(5);
    expect(r.availablePercent).toBe(100);
  });

  it('respecte la fenêtre demandée (24 h) même avec un historique plus long', () => {
    const now = at(3 * 1440);
    const samples = [...run(0, 1439, 'unavailable'), ...run(1440, 3 * 1440 - 1, 'healthy')];
    const day = computeUptime(samples, 86_400_000, now, at(0));
    expect(day.availablePercent).toBe(100);
    const all = computeUptime(samples, 3 * 86_400_000, now, at(0));
    expect(all.availablePercent).toBeCloseTo(66.67, 1);
  });
});
