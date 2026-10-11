import { floorResources, snapResource, updateResources } from '@xnova/game-engine';

const levels = {
  metalMine: 0,
  crystalMine: 0,
  deuteriumMine: 0,
  solarPlant: 0,
  fusionPlant: 0,
  metalStorage: 0,
  crystalStorage: 0,
  deuteriumStorage: 0,
};

describe('Moteur de ressources — conservation des fractions (ECO-01)', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const config = { gameSpeed: 1, resourceMultiplier: 1 };

  it('donne le même résultat pour 1 pas d\'une heure et 360 pas de 10 s', () => {
    const oneStep = updateResources({
      resources: { metal: 500, crystal: 500, deuterium: 0 },
      levels,
      lastUpdate: start,
      now: new Date(start.getTime() + 3_600_000),
      config,
    });

    let state = { metal: 500, crystal: 500, deuterium: 0 };
    let last = start;
    for (let i = 1; i <= 360; i++) {
      const now = new Date(start.getTime() + i * 10_000);
      const step = updateResources({ resources: state, levels, lastUpdate: last, now, config });
      state = step.resources;
      last = step.lastUpdate;
    }

    expect(oneStep.resources.metal).toBeCloseTo(520, 6);
    expect(oneStep.resources.crystal).toBeCloseTo(510, 6);
    expect(state.metal).toBeCloseTo(oneStep.resources.metal, 6);
    expect(state.crystal).toBeCloseTo(oneStep.resources.crystal, 6);
    expect(state.deuterium).toBe(0);
  });

  it('simule une API interrogée toutes les secondes sans perte', () => {
    let state = { metal: 0, crystal: 0, deuterium: 0 };
    let last = start;
    for (let i = 1; i <= 3600; i++) {
      const step = updateResources({
        resources: state,
        levels,
        lastUpdate: last,
        now: new Date(start.getTime() + i * 1000),
        config,
      });
      state = step.resources;
      last = step.lastUpdate;
    }
    expect(state.metal).toBeCloseTo(20, 6);
    expect(state.crystal).toBeCloseTo(10, 6);
  });

  it('floorResources arrondit à l\'affichage seulement', () => {
    expect(floorResources({ metal: 12.9, crystal: 0.4, deuterium: 7 })).toEqual({
      metal: 12,
      crystal: 0,
      deuterium: 7,
    });
  });

  it('ramène le bruit flottant à l\'entier voisin sans toucher aux vraies fractions', () => {
    expect(snapResource(519.9999999999956)).toBe(520);
    expect(snapResource(520.0000000000044)).toBe(520);
    expect(snapResource(519.5)).toBe(519.5);
    expect(snapResource(519.99)).toBe(519.99);
    expect(
      floorResources({ metal: 519.9999999999956, crystal: 0.9999999, deuterium: 7.4 }),
    ).toEqual({ metal: 520, crystal: 1, deuterium: 7 });
  });

  it('un stock juste sous un entier après production est affiché sans perdre une unité', () => {
    // 500 de départ + 20/h pendant 1 h = 520 exactement, mais accumulé par petits pas flottants
    let stock = { metal: 500, crystal: 0, deuterium: 0 };
    let last = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < 360; i++) {
      const now = new Date(last.getTime() + 10_000);
      stock = updateResources({ resources: stock, levels, lastUpdate: last, now }).resources;
      last = now;
    }
    expect(floorResources(stock).metal).toBe(520);
  });
});

describe('Moteur de ressources — satellites solaires', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const hour = new Date(start.getTime() + 3600 * 1000);
  const config = { gameSpeed: 1, resourceMultiplier: 1 };
  const withMine = { ...levels, metalMine: 5 };

  it('chaque satellite ajoute 50 d\'énergie disponible', () => {
    const none = updateResources({
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      levels: { ...withMine, solarSatellites: 0 },
      lastUpdate: start,
      now: hour,
      config,
    });
    const three = updateResources({
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      levels: { ...withMine, solarSatellites: 3 },
      lastUpdate: start,
      now: hour,
      config,
    });
    expect(none.energy.available).toBe(0);
    expect(none.energy.productionLevel).toBe(0);
    expect(three.energy.available).toBe(150);
    expect(three.energy.productionLevel).toBe(100);
    expect(three.resources.metal).toBeGreaterThan(none.resources.metal + 200);
  });

  it('s\'additionne aux centrales et ignore les valeurs invalides', () => {
    const solar = updateResources({
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      levels: { ...withMine, solarPlant: 1 },
      lastUpdate: start,
      now: hour,
      config,
    });
    const combined = updateResources({
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      levels: { ...withMine, solarPlant: 1, solarSatellites: 2 },
      lastUpdate: start,
      now: hour,
      config,
    });
    expect(combined.energy.available).toBe(solar.energy.available + 100);
    for (const bad of [-4, Number.NaN, undefined]) {
      const r = updateResources({
        resources: { metal: 0, crystal: 0, deuterium: 0 },
        levels: { ...withMine, solarSatellites: bad as number },
        lastUpdate: start,
        now: hour,
        config,
      });
      expect(r.energy.available).toBe(0);
    }
  });
});
