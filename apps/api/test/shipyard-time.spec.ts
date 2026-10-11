import {
  SHIPS,
  SHIPYARD_FLOOR_DIVISOR,
  calculateShipyardBatchSeconds,
  calculateShipyardUnitSeconds,
} from '@xnova/game-config';

const unit = (id: number, shipyardLevel: number, naniteLevel: number, gameSpeed: number) =>
  calculateShipyardUnitSeconds({ cost: SHIPS[id].cost, shipyardLevel, naniteLevel, gameSpeed });

describe('durée de fabrication au chantier spatial', () => {
  it('chasseur léger à ×50 : 47,5 s sans technologie, plancher de 5 s une fois tout développé', () => {
    expect(unit(204, 1, 0, 50)).toBeCloseTo(47.52, 1); // hangar 1, aucun nanite : formule d'origine (heures × 3600)
    expect(unit(204, 5, 0, 50)).toBeCloseTo(15.84, 1);
    expect(unit(204, 8, 3, 50)).toBe(5); // la base (1,3 s) passe sous le plancher : (2 500 + 800) / 660 = 5 s
    expect(unit(204, 20, 10, 50)).toBe(5);
  });

  it('Étoile de la Mort à ×50 : jamais sous 3 h 47, quels que soient hangar et nanites', () => {
    const floor = 9_000_000 / SHIPYARD_FLOOR_DIVISOR; // 13 636 s
    expect(unit(214, 12, 6, 50)).toBeCloseTo(floor, 5);
    expect(unit(214, 20, 10, 50)).toBeCloseTo(floor, 5);
    expect(floor / 3600).toBeCloseTo(3.79, 2);
    // sans nanites la formule d'origine est plus lente que le plancher
    expect(unit(214, 12, 0, 50)).toBeGreaterThan(floor);
    // proportion avec le chasseur : celle des coûts
    expect(unit(214, 20, 10, 50) / unit(204, 20, 10, 50)).toBeCloseTo(9_000_000 / 3_300, 0);
  });

  it('suit la vitesse du serveur, plancher compris', () => {
    expect(unit(204, 20, 10, 1)).toBeCloseTo(250, 5); // plancher ×50 = 5 s → 250 s à ×1
    expect(unit(204, 20, 10, 100)).toBeCloseTo(2.5, 5);
    expect(unit(204, 1, 0, 1)).toBeCloseTo(2376, 0); // 3 300 / 5 000 h = 39,6 min
  });

  it('un lot dure floor(unité × quantité), au moins 1 s', () => {
    const input = { cost: SHIPS[204].cost, shipyardLevel: 10, naniteLevel: 4, gameSpeed: 50 };
    expect(calculateShipyardBatchSeconds(input, 1)).toBe(5);
    expect(calculateShipyardBatchSeconds(input, 1000)).toBe(5000);
    // vitesse énorme : jamais en dessous d'une seconde
    expect(calculateShipyardBatchSeconds({ ...input, gameSpeed: 100000 }, 1)).toBe(1);
  });

  it('ignore une vitesse invalide', () => {
    expect(unit(204, 1, 0, 0)).toBe(unit(204, 1, 0, 1));
  });
});
