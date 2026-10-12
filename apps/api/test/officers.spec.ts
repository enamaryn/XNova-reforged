import { OFFICERS, OFFICER_TYPES, officerBonuses, reducedSeconds } from '@xnova/game-config';
import { calculateEnergyBalance, calculateMineProduction, calculateStorageCapacity } from '@xnova/game-engine';

const levels = {
  metalMine: 10, crystalMine: 8, deuteriumMine: 6, solarPlant: 12, fusionPlant: 0,
  metalStorage: 1, crystalStorage: 1, deuteriumStorage: 1,
};

describe('officiers : bonus', () => {
  it('cinq officiers, sans bonus par défaut', () => {
    expect(OFFICER_TYPES).toHaveLength(5);
    expect(officerBonuses([])).toMatchObject({ energy: 0, mineProduction: 0, extraExpeditions: 0 });
  });

  it('cumule les bonus des officiers embauchés, doublons et types inconnus ignorés', () => {
    const bonus = officerBonuses(['geologist', 'geologist', 'admiral', 'inconnu']);
    expect(bonus.mineProduction).toBeCloseTo(0.1);
    expect(bonus.storage).toBeCloseTo(0.1);
    expect(bonus.fleetSpeed).toBeCloseTo(0.1);
    expect(bonus.extraExpeditions).toBe(2);
    expect(bonus.energy).toBe(0);
  });

  it('chaque officier apporte au moins un bonus', () => {
    for (const type of OFFICER_TYPES) expect(Object.keys(OFFICERS[type].bonus).length).toBeGreaterThan(0);
  });

  it('réduction de durée : plancher à 1 s, plafond à 90 %', () => {
    expect(reducedSeconds(100, 0.1)).toBe(90);
    expect(reducedSeconds(1, 0.1)).toBe(1);
    expect(reducedSeconds(100, 5)).toBe(10);
    expect(reducedSeconds(100, -1)).toBe(100);
  });
});

describe('officiers : moteur de production', () => {
  it('le géologue relève les mines de 10 % et le stockage de 10 %', () => {
    const base = calculateMineProduction(levels);
    const boosted = calculateMineProduction({ ...levels, mineBonus: 0.1 });
    expect(boosted.metal).toBeCloseTo(base.metal * 1.1);
    expect(boosted.deuterium).toBeCloseTo(base.deuterium * 1.1);
    const storage = calculateStorageCapacity(levels);
    const more = calculateStorageCapacity({ ...levels, storageBonus: 0.1 });
    expect(more.metal).toBe(Math.floor(storage.metal * 1.1));
  });

  it("l'intendant relève l'énergie de 10 %, la consommation est inchangée", () => {
    const base = calculateEnergyBalance(levels);
    const boosted = calculateEnergyBalance({ ...levels, energyBonus: 0.1 });
    expect(boosted.available).toBe(Math.floor((base.available) * 1.1));
    expect(boosted.used).toBe(base.used);
  });
});
