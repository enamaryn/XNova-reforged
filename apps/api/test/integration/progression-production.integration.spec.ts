import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DatabaseService } from "../../src/database/database.service";
import { BuildingsService } from "../../src/buildings/buildings.service";
import { ShipyardService } from "../../src/shipyard/shipyard.service";
import { ProgressionService } from "../../src/progression/progression.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";

describe("Commander, power and production capacities", () => {
  let app: INestApplication,
    db: DatabaseService,
    buildings: BuildingsService,
    yard: ShipyardService,
    progression: ProgressionService;
  let username: string, userId: string, planetId: string, token: string;
  beforeAll(async () => {
    const setup = await createIntegrationApp();
    app = setup.app;
    db = setup.database;
    buildings = app.get(BuildingsService);
    yard = app.get(ShipyardService);
    progression = app.get(ProgressionService);
  });
  beforeEach(async () => {
    const credentials = buildTestUser();
    username = credentials.username;
    token = (await registerAndLogin(app, credentials)).accessToken;
    const user = await db.user.findUniqueOrThrow({
      where: { username },
      include: { planets: true },
    });
    userId = user.id;
    planetId = user.planets[0].id;
    await db.planet.update({
      where: { id: planetId },
      data: {
        metal: 1e9,
        crystal: 1e9,
        deuterium: 1e9,
        shipyard: 4,
        researchLab: 3,
      },
    });
    await tech(115, 3);
  });
  afterEach(async () => {
    await cleanupTestUser(db, username);
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  const tech = (techId: number, level = 1) =>
    db.technology.upsert({
      where: { userId_techId: { userId, techId } },
      create: { userId, techId, level },
      update: { level },
    });
  const build = (id: number) =>
    buildings.startConstruction(planetId, id, userId);
  const auth = () => ({ Authorization: `Bearer ${token}` });
  it("limits different building types atomically; each planet has its own capacity", async () => {
    const results = await Promise.allSettled([build(1), build(2), build(3)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.buildQueue.count({ where: { planetId, completed: false } }),
    ).toBe(1);
    const catalog = await buildings.getAvailableBuildings(planetId, userId);
    expect(catalog.buildings.every((b) => !b.canBuild && b.capacityFull)).toBe(
      true,
    );
    await tech(125);
    await db.buildQueue.deleteMany({ where: { planetId } });
    await build(1);
    await build(2);
    await expect(build(3)).rejects.toMatchObject({ status: 400 });
    await db.planet.update({
      where: { id: planetId },
      data: { metalMine: 50 },
    });
    expect((await progression.get(userId)).buildingCapacity).toBe(3);
    await build(3);
    await expect(build(4)).rejects.toMatchObject({ status: 400 });
    await db.planet.update({ where: { id: planetId }, data: { metalMine: 0 } });
    await expect(build(4)).rejects.toMatchObject({ status: 400 });
    expect(
      await db.buildQueue.count({ where: { planetId, completed: false } }),
    ).toBe(3); // Existing work survives downgrade.
  });
  it("requires the technology even for a level-100 commander", async () => {
    await db.planet.update({
      where: { id: planetId },
      data: { metalMine: 50 },
    });
    const p = await progression.get(userId);
    expect(p.commanderLevel).toBe(100);
    expect(p.buildingCapacity).toBe(1);
    expect(p.productionCapacity).toBe(1);
  });
  it("queues prepaid lots, refunds 90 % only once and rejects cancellation of started work", async () => {
    const active = await yard.startBuild(planetId, 202, 1000, userId);
    const before = await db.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    const pending = await yard.startBuild(planetId, 204, 7, userId);
    const queue = await yard.getShipyardQueue(planetId, userId);
    expect(queue.find((q) => q.id === active.queueId)).toMatchObject({
      status: "active",
      canCancel: false,
    });
    expect(queue.find((q) => q.id === pending.queueId)).toMatchObject({
      status: "waiting",
      canCancel: true,
    });
    const after = await db.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    expect(before.metal - after.metal).toBe(pending.cost.metal);
    await expect(
      yard.cancelBuild(active.queueId, userId),
    ).rejects.toMatchObject({ status: 400 });
    const results = await Promise.allSettled([
      yard.cancelBuild(pending.queueId, userId),
      yard.cancelBuild(pending.queueId, userId),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const restored = await db.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    expect(restored.metal).toBe(
      before.metal - pending.cost.metal + Math.floor(pending.cost.metal * 0.9),
    );
    expect(restored.crystal).toBe(
      before.crystal -
        pending.cost.crystal +
        Math.floor(pending.cost.crystal * 0.9),
    );
  });
  it("unlocks two then three different types while serializing identical types and sharing defenses", async () => {
    await tech(126);
    await yard.startBuild(planetId, 202, 1000, userId);
    await yard.startBuild(planetId, 204, 1000, userId);
    const defense = await yard.startBuild(
      planetId,
      401,
      1000,
      userId,
      "defense",
    );
    let queue = await yard.getShipyardQueue(planetId, userId);
    expect(queue.filter((q) => q.status === "active")).toHaveLength(2);
    expect(queue.find((q) => q.id === defense.queueId)?.status).toBe("waiting");
    await db.planet.update({
      where: { id: planetId },
      data: { metalMine: 50 },
    });
    await yard.getCompletedBuilds(); // Upgrade applied without needing to place another order.
    queue = await yard.getShipyardQueue(planetId, userId);
    expect(queue.filter((q) => q.status === "active")).toHaveLength(3);
    const sameType = await yard.startBuild(planetId, 202, 2, userId);
    expect(new Date(sameType.startTime).getTime()).toBeGreaterThan(Date.now());
  });
  it("reflows a single remaining waiting lot when a preceding waiting lot is removed", async () => {
    await yard.startBuild(planetId, 202, 1000, userId);
    const first = await yard.startBuild(planetId, 204, 100, userId);
    const next = await yard.startBuild(planetId, 204, 100, userId);
    const oldStart = next.startTime.getTime();
    await yard.cancelBuild(first.queueId, userId);
    const current = await db.shipQueue.findUniqueOrThrow({
      where: { id: next.queueId },
    });
    expect(current.startTime.getTime()).toBeLessThan(oldStart);
  });
  it("power changes with losses and colonies, stocks/queues never affect commander; fleets counted once", async () => {
    const base = await progression.get(userId);
    await db.ship.create({ data: { planetId, shipId: 202, amount: 10 } });
    await db.defense.create({ data: { planetId, defenseId: 401, amount: 5 } });
    const army = await progression.get(userId);
    expect(army.power - base.power).toBe(50);
    expect(army.development).toBe(base.development);
    await db.ship.update({
      where: { planetId_shipId: { planetId, shipId: 202 } },
      data: { amount: 5 },
    });
    const planet = await db.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    const fleet = await db.fleet.create({
      data: {
        userId,
        mission: 3,
        fromGalaxy: planet.galaxy,
        fromSystem: planet.system,
        fromPosition: planet.position,
        toGalaxy: planet.galaxy,
        toSystem: planet.system,
        toPosition: planet.position,
        ships: { 202: 5 },
        cargo: {},
        startTime: new Date(),
        arrivalTime: new Date(Date.now() + 60000),
        status: "traveling",
      },
    });
    expect((await progression.get(userId)).power).toBe(army.power);
    await db.fleet.update({
      where: { id: fleet.id },
      data: { ships: { 202: 2 } },
    });
    await db.defense.update({
      where: { planetId_defenseId: { planetId, defenseId: 401 } },
      data: { amount: 2 },
    });
    const losses = await progression.get(userId);
    expect(army.power - losses.power).toBe(18);
    expect(losses.commanderLevel).toBe(army.commanderLevel);
    const occupied = await db.planet.findMany({
      where: { galaxy: planet.galaxy, system: planet.system },
      select: { position: true },
    });
    const position = Array.from({ length: 15 }, (_, i) => i + 1).find(
      (p) => !occupied.some((row) => row.position === p),
    )!;
    await db.planet.create({
      data: {
        userId,
        name: "Colonie",
        galaxy: planet.galaxy,
        system: planet.system,
        position,
        planetType: "normal",
        fieldsMax: 163,
      },
    });
    expect((await progression.get(userId)).power).toBe(losses.power + 1000);
    const response = await request(app.getHttpServer())
      .get("/progression")
      .set(auth())
      .expect(200);
    expect(response.body.power).toBe(losses.power + 1000);
    const statistics = await request(app.getHttpServer())
      .get("/statistics")
      .set(auth())
      .expect(200);
    expect(statistics.body.personal.points).toBe(response.body.power);
    expect(statistics.body.personal.progression).toEqual(response.body);
    await request(app.getHttpServer()).get("/progression").expect(401);
  });
});
