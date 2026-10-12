import {
  IMPLEMENTED_BUILDINGS,
  MOON_BUILDINGS,
  buildingsAvailableFor,
  moonChancePercent,
} from '@xnova/game-config';
import { updateResources } from '@xnova/game-engine';

describe('lunes : règles pures', () => {
  it('chance de lune : 1 % par 100 000 de débris, plafonnée à 20 %', () => {
    expect(moonChancePercent(0, 0)).toBe(0);
    expect(moonChancePercent(99_999, 0)).toBe(0);
    expect(moonChancePercent(60_000, 40_000)).toBe(1);
    expect(moonChancePercent(500_000, 250_000)).toBe(7);
    expect(moonChancePercent(50_000_000, 50_000_000)).toBe(20);
    expect(moonChancePercent(-5, Number.NaN)).toBe(0);
  });

  it('bâtiments selon le lieu : la base lunaire seulement sur une lune, pas de mines', () => {
    const onMoon = buildingsAvailableFor(true, IMPLEMENTED_BUILDINGS);
    const onPlanet = buildingsAvailableFor(false, IMPLEMENTED_BUILDINGS);
    expect([...onMoon].sort((a, b) => a - b)).toEqual([...MOON_BUILDINGS].sort((a, b) => a - b));
    expect(onMoon).not.toContain(1);
    expect(onPlanet).not.toContain(41);
    expect(onPlanet).toContain(1);
    expect(onPlanet).toContain(44);
  });

  it('une lune ne produit aucun revenu de base, une planète oui', () => {
    const levels = {
      metalMine: 0, crystalMine: 0, deuteriumMine: 0, solarPlant: 0, fusionPlant: 0,
      metalStorage: 0, crystalStorage: 0, deuteriumStorage: 0,
    };
    const base = {
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      lastUpdate: new Date(0),
      now: new Date(3_600_000),
      config: { baseIncome: { metal: 20, crystal: 10, deuterium: 0 } },
    };
    const planet = updateResources({ ...base, levels });
    const moon = updateResources({ ...base, levels: { ...levels, isMoon: true } });
    expect(planet.resources.metal).toBeGreaterThan(0);
    expect(moon.resources).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
  });
});
