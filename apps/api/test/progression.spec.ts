import {
  calculateProgression,
  commanderLevel,
  commanderThreshold,
  constructionCapacity,
  scheduleProduction,
} from "@xnova/game-config";

describe("Commander and power rules", () => {
  const empty = { planets: [], technologies: [], fleets: [] };
  it("caps commander at 100 and unlocks the third slot only with technology AND level 50", () => {
    expect(commanderLevel(0)).toBe(1);
    expect(commanderLevel(commanderThreshold(50) - 1)).toBe(49);
    expect(commanderLevel(commanderThreshold(50))).toBe(50);
    expect(commanderLevel(Number.MAX_SAFE_INTEGER)).toBe(100);
    expect(constructionCapacity(0, 100)).toBe(1);
    expect(constructionCapacity(1, 49)).toBe(2);
    expect(constructionCapacity(1, 50)).toBe(3);
  });
  it("military units and colonies raise power but never commander development", () => {
    const result = calculateProgression({
      ...empty,
      planets: [
        {
          buildings: {},
          planetType: "normal",
          ships: [{ shipId: 202, amount: 2 }],
          defenses: [{ defenseId: 401, amount: 3 }],
        },
        { buildings: {}, planetType: "normal", ships: [], defenses: [] },
        { buildings: {}, planetType: "moon", ships: [], defenses: [] },
      ],
      fleets: [{ ships: { 202: 1 } }],
    });
    expect(result.commanderLevel).toBe(1);
    expect(result.development).toBe(0);
    expect(result.breakdown).toEqual({
      buildings: 0,
      research: 0,
      ships: 12,
      defenses: 6,
      colonies: 1000,
    });
    expect(result.power).toBe(1018);
  });
  it("buildings and research alone reach 100; rebuilding does not accumulate XP", () => {
    const developed = {
      ...empty,
      planets: [
        {
          buildings: { metalMine: 50 },
          planetType: "normal",
          ships: [],
          defenses: [],
        },
      ],
    };
    const first = calculateProgression(developed);
    expect(first.commanderLevel).toBe(100);
    expect(calculateProgression(empty).commanderLevel).toBe(1);
    expect(calculateProgression(developed)).toEqual(first);
  });
});
describe("Production schedule", () => {
  const now = new Date(10000);
  const entry = (
    id: string,
    shipId: number,
    start: number,
    end: number,
    created: number,
  ) => ({
    id,
    shipId,
    startTime: new Date(start),
    endTime: new Date(end),
    createdAt: new Date(created),
  });
  it("uses two lanes, keeps FIFO and prevents two identical types in parallel", () => {
    const queue = [
      entry("active", 202, 0, 20000, 0),
      entry("a", 204, 20001, 30001, 1),
      entry("b", 202, 30001, 40001, 2),
      entry("c", 205, 40001, 50001, 3),
    ];
    const result = scheduleProduction(queue, 2, now);
    expect(result.map((q) => q.startTime.getTime())).toEqual([
      10000, 20000, 20000,
    ]);
    expect(result.map((q) => q.endTime.getTime())).toEqual([
      20000, 30000, 30000,
    ]);
  });
  it("preserves active legacy lots above capacity and waits until a lane is really free", () => {
    const queue = [
      entry("a", 202, 0, 20000, 0),
      entry("b", 204, 0, 30000, 1),
      entry("c", 205, 0, 40000, 2),
      entry("d", 206, 50000, 60000, 3),
    ];
    expect(scheduleProduction(queue, 1, now)[0].startTime.getTime()).toBe(
      40000,
    );
    expect(scheduleProduction(queue, 2, now)[0].startTime.getTime()).toBe(
      30000,
    );
  });
  it("a sole waiting lot starts immediately after cancellation and keeps its paid duration", () => {
    const result = scheduleProduction(
      [entry("a", 204, 20000, 35000, 0)],
      1,
      now,
    );
    expect(result[0].startTime).toEqual(now);
    expect(result[0].endTime.getTime()).toBe(25000);
  });
});
