import { RECOMMENDED_SPEED_PROFILE, SPEED_PROFILES } from '@xnova/game-config';

describe('Profils de vitesse', () => {
  it('le profil recommandé est le ×50 de référence, coûts et revenus d\'origine', () => {
    expect(RECOMMENDED_SPEED_PROFILE).toBe('reference');
    expect(SPEED_PROFILES.reference).toEqual({
      gameSpeed: 50,
      fleetSpeed: 50,
      resourceMultiplier: 1,
      buildingCostMultiplier: 1,
      researchCostMultiplier: 1,
      shipCostMultiplier: 1,
      baseMetal: 20,
      baseCrystal: 10,
      baseDeuterium: 0,
    });
  });

  it('les profils ne diffèrent que par la vitesse et exposent les mêmes clés', () => {
    const keys = Object.keys(SPEED_PROFILES.reference).sort();
    for (const profile of Object.values(SPEED_PROFILES)) {
      expect(Object.keys(profile).sort()).toEqual(keys);
      expect(profile.resourceMultiplier).toBe(1);
      expect(profile.buildingCostMultiplier).toBe(1);
    }
    expect(SPEED_PROFILES.classic.gameSpeed).toBe(1);
    expect(SPEED_PROFILES.minimum.gameSpeed).toBe(20);
  });
});
