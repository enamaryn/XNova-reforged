import { getBuildingTime } from "@xnova/game-config";
import { BuildingsService } from "../src/buildings/buildings.service";
import { getBuildingUpgradeEffects } from "../src/buildings/building-upgrade-effects";

const planet = {
  id: "planet",
  userId: "user",
  metal: 100000,
  crystal: 100000,
  deuterium: 100000,
  metalMine: 0,
  crystalMine: 4,
  deuteriumMine: 0,
  solarPlant: 10,
  fusionPlant: 0,
  metalStorage: 0,
  crystalStorage: 0,
  deuteriumStorage: 0,
  roboticsFactory: 0,
  naniteFactory: 0,
  shipyard: 0,
  researchLab: 0,
  fieldsUsed: 14,
  fieldsMax: 163,
};
const config = {
  gameSpeed: 1,
  resourceMultiplier: 1,
  baseIncome: { metal: 20, crystal: 10, deuterium: 0 },
  storageBase: 1000000,
  storageFactor: 1.5,
  storageOverflow: 1.1,
};

describe("Prévision du prochain niveau", () => {
  it("cristal 4 → 5 : gain horaire, perte d’énergie et production réelle", () => {
    const upgrade = getBuildingUpgradeEffects(
      2,
      4,
      planet,
      config,
      { 2: 4 },
      {},
    );
    expect(upgrade.nextLevel).toBe(5);
    const gain = upgrade.effects.find((effect) => effect.key === "potential")!;
    expect(gain.current).toBeCloseTo(117.128);
    expect(gain.next).toBeCloseTo(161.051);
    expect(gain.delta).toBeCloseTo(43.923);
    expect(gain.beneficial).toBe(true);
    expect(
      upgrade.effects.find((effect) => effect.key === "energy")?.delta,
    ).toBe(-22);
    expect(
      upgrade.effects.find((effect) => effect.key === "production-crystal")
        ?.delta,
    ).toBeCloseTo(43.923);
    expect(upgrade.energyLimited).toBe(false);
    expect(planet.crystalMine).toBe(4); // Prévision sans mutation de la planète.
  });

  it("respecte les multiplicateurs sans multiplier la consommation d’énergie", () => {
    const upgrade = getBuildingUpgradeEffects(
      2,
      4,
      planet,
      { ...config, gameSpeed: 3, resourceMultiplier: 2 },
      {},
      {},
    );
    expect(
      upgrade.effects.find((effect) => effect.key === "potential")?.delta,
    ).toBeCloseTo(43.923 * 6);
    expect(
      upgrade.effects.find((effect) => effect.key === "energy")?.delta,
    ).toBe(-22);
  });

  it("une mine peut réduire la production des autres mines si l’énergie manque", () => {
    const upgrade = getBuildingUpgradeEffects(
      2,
      4,
      { ...planet, metalMine: 5, solarPlant: 3 },
      config,
      {},
      {},
    );
    expect(upgrade.energyLimited).toBe(true);
    const metal = upgrade.effects.find(
      (effect) => effect.key === "production-metal",
    )!;
    expect(metal.delta).toBeLessThan(0);
    expect(metal.beneficial).toBe(false);
    expect(
      upgrade.effects.find((effect) => effect.key === "potential")?.delta,
    ).toBeGreaterThan(0);
  });

  it("la centrale augmente l’énergie et la production effective en situation de pénurie", () => {
    const upgrade = getBuildingUpgradeEffects(
      4,
      3,
      { ...planet, metalMine: 5, solarPlant: 3 },
      config,
      {},
      {},
    );
    expect(
      upgrade.effects.find((effect) => effect.key === "energy")?.delta,
    ).toBeGreaterThan(0);
    expect(
      upgrade.effects.find((effect) => effect.key === "production-crystal")
        ?.delta,
    ).toBeGreaterThan(0);
  });

  it("le stockage ajoute sa capacité sans prendre une case", () => {
    const upgrade = getBuildingUpgradeEffects(23, 0, planet, config, {}, {});
    expect(
      upgrade.effects.find((effect) => effect.key === "storage"),
    ).toMatchObject({ current: 1000000, next: 1500000, delta: 500000 });
    expect(upgrade.effects.some((effect) => effect.key === "fields")).toBe(
      false,
    );
  });

  it("robots et nanites réduisent les durées ; les autres prérequis restent nécessaires", () => {
    const robotics = getBuildingUpgradeEffects(
      14,
      9,
      planet,
      config,
      { 14: 9 },
      { 108: 10 },
    );
    expect(
      robotics.effects.find((effect) => effect.key === "building-duration")
        ?.delta,
    ).toBeCloseTo(-100 / 11);
    expect(robotics.unlocks).toContain("Usine de Nanites");
    expect(
      getBuildingUpgradeEffects(14, 9, planet, config, { 14: 9 }, {}).unlocks,
    ).not.toContain("Usine de Nanites");
    const nanites = getBuildingUpgradeEffects(15, 0, planet, config, {}, {});
    expect(
      nanites.effects
        .filter((effect) => effect.key.endsWith("-duration"))
        .map((effect) => effect.delta),
    ).toEqual([-50, -50]);
  });
});

describe("Durées de construction des bâtiments", () => {
  const time = (
    buildingId: number,
    currentLevel = 0,
    roboticsLevel = 0,
    naniteLevel = 0,
  ) =>
    getBuildingTime({ buildingId, currentLevel, roboticsLevel, naniteLevel });
  it("commence à 30 s pour le métal, suit les coûts et augmente exponentiellement", () => {
    expect(time(1)).toBe(30);
    expect(time(2)).toBe(28);
    expect(time(3)).toBe(120);
    expect([0, 1, 2, 3].map((level) => time(1, level))).toEqual([
      30, 44, 67, 100,
    ]);
    expect(time(1, 10)).toBeGreaterThan(1700);
  });
  it("applique robots et nanites avec un minimum d’une seconde", () => {
    expect(time(1, 0, 1)).toBe(15);
    expect(time(1, 0, 0, 1)).toBe(15);
    expect(time(1, 0, 10, 10)).toBe(1);
  });

  it("la liste affiche la durée réellement lancée, et aucun prochain niveau au maximum", async () => {
    const database = {
      planet: { findUnique: jest.fn().mockResolvedValue(planet) },
      technology: { findMany: jest.fn().mockResolvedValue([]) },
      buildQueue: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const serverConfig = {
      getConfig: jest
        .fn()
        .mockResolvedValue({
          maxBuildingLevel: 4,
          buildingCostMultiplier: 2,
          gameSpeed: 3,
        }),
      getResourceConfig: jest
        .fn()
        .mockResolvedValue({ ...config, gameSpeed: 3 }),
    };
    const service = new BuildingsService(
      database as never,
      serverConfig as never,
      {} as never,
    );
    const list = await service.getAvailableBuildings("planet", "user");
    expect(
      list.buildings.find((building) => building.id === 1)?.buildTime,
    ).toBe(20);
    expect(
      list.buildings.find((building) => building.id === 2)?.upgrade,
    ).toBeNull();
    expect(
      list.buildings.find((building) => building.id === 1)?.upgrade?.nextLevel,
    ).toBe(1);
  });
});
