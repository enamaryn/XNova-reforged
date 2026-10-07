import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DatabaseService } from "../../src/database/database.service";
import {
  ServerConfigService,
  type ServerConfigValues,
} from "../../src/server-config/server-config.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";

describe("Durées et effets des améliorations", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let config: ServerConfigService;
  let previous: ServerConfigValues;
  let username: string;
  let userId: string;
  let planetId: string;
  let token: string;
  beforeAll(async () => {
    ({ app, database } = await createIntegrationApp());
    config = app.get(ServerConfigService);
    previous = await config.getConfig();
    await config.applyConfig({
      gameSpeed: 1,
      resourceMultiplier: 1,
      buildingCostMultiplier: 1,
      researchCostMultiplier: 1,
    });
    const user = buildTestUser();
    username = user.username;
    token = (await registerAndLogin(app, user)).accessToken;
    const saved = await database.user.findUniqueOrThrow({
      where: { username },
      include: { planets: true },
    });
    userId = saved.id;
    planetId = saved.planets[0].id;
  });
  afterAll(async () => {
    if (previous) await config.applyConfig(previous);
    if (username) await cleanupTestUser(database, username);
    await app?.close();
  });
  beforeEach(async () => {
    await database.buildQueue.deleteMany({ where: { planetId } });
    await database.researchQueue.deleteMany({ where: { userId } });
    await database.technology.deleteMany({ where: { userId } });
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 1000000,
        crystal: 1000000,
        deuterium: 1000000,
        metalMine: 0,
        crystalMine: 4,
        solarPlant: 10,
        roboticsFactory: 0,
        naniteFactory: 0,
        researchLab: 1,
      },
    });
    await config.applyConfig({
      gameSpeed: 1,
      buildingCostMultiplier: 1,
      researchCostMultiplier: 1,
    });
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });
  it("expose les effets et lance la durée affichée pour le métal niveau 1", async () => {
    const list = await request(app.getHttpServer())
      .get(`/planets/${planetId}/buildings`)
      .set(auth())
      .expect(200);
    const metal = list.body.buildings.find(
      (building: { id: number }) => building.id === 1,
    );
    expect(metal.buildTime).toBe(30);
    const crystal = list.body.buildings.find(
      (building: { id: number }) => building.id === 2,
    );
    expect(crystal.upgrade.nextLevel).toBe(5);
    expect(
      crystal.upgrade.effects.find(
        (effect: { key: string }) => effect.key === "potential",
      ).delta,
    ).toBeCloseTo(43.923);
    const start = await request(app.getHttpServer())
      .post(`/planets/${planetId}/build`)
      .set(auth())
      .send({ buildingId: 1 })
      .expect(201);
    expect(
      (new Date(start.body.endTime).getTime() -
        new Date(start.body.startTime).getTime()) /
        1000,
    ).toBe(metal.buildTime);
  });
  it("Ordinateur niveau 1 prend 30 secondes et les niveaux suivants augmentent exponentiellement", async () => {
    const get = async () =>
      (
        await request(app.getHttpServer())
          .get("/technologies")
          .query({ planetId })
          .set(auth())
          .expect(200)
      ).body.technologies.find((tech: { id: number }) => tech.id === 108);
    expect((await get()).buildTime).toBe(30);
    const start = await request(app.getHttpServer())
      .post("/research")
      .set(auth())
      .send({ planetId, techId: 108 })
      .expect(201);
    expect(
      (new Date(start.body.endTime).getTime() -
        new Date(start.body.startTime).getTime()) /
        1000,
    ).toBe(30);
    await database.technology.create({
      data: { userId, techId: 108, level: 1 },
    });
    expect((await get()).buildTime).toBe(54);
  });
  it("la vitesse du serveur s’applique aux deux listes et aux deux files", async () => {
    await config.applyConfig({
      gameSpeed: 3,
      buildingCostMultiplier: 2,
      researchCostMultiplier: 2,
    });
    const buildings = await request(app.getHttpServer())
      .get(`/planets/${planetId}/buildings`)
      .set(auth())
      .expect(200);
    expect(
      buildings.body.buildings.find((row: { id: number }) => row.id === 1)
        .buildTime,
    ).toBe(20);
    const build = await request(app.getHttpServer())
      .post(`/planets/${planetId}/build`)
      .set(auth())
      .send({ buildingId: 1 })
      .expect(201);
    expect(
      (new Date(build.body.endTime).getTime() -
        new Date(build.body.startTime).getTime()) /
        1000,
    ).toBe(20);
    const technologies = await request(app.getHttpServer())
      .get("/technologies")
      .query({ planetId })
      .set(auth())
      .expect(200);
    expect(
      technologies.body.technologies.find(
        (row: { id: number }) => row.id === 108,
      ).buildTime,
    ).toBe(20);
    const research = await request(app.getHttpServer())
      .post("/research")
      .set(auth())
      .send({ planetId, techId: 108 })
      .expect(201);
    expect(
      (new Date(research.body.endTime).getTime() -
        new Date(research.body.startTime).getTime()) /
        1000,
    ).toBe(20);
  });
});
