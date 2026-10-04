import { floorResources, updateResources } from '@xnova/game-engine';

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
});
