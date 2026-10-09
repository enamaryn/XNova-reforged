import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DatabaseService } from "../../src/database/database.service";
import { BuildingsService } from "../../src/buildings/buildings.service";
import { ServerConfigService } from "../../src/server-config/server-config.service";
import {
  buildTestUser,
  createIntegrationApp,
  cleanupTestUser,
  useIsolatedSchema,
} from "./helpers";

describe("Production au changement de niveau d’un bâtiment", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;
  let username: string;
  let planetId: string;
  let userId: string;
  let token: string;
  let base: number;
  beforeAll(async () => {
    isolated = await useIsolatedSchema("building_transition");
    ({ app, database } = await createIntegrationApp());
    await app
      .get(ServerConfigService)
      .applyConfig({
        gameSpeed: 1,
        resourceMultiplier: 1,
        buildingCostMultiplier: 1,
        baseMetal: 20,
        baseCrystal: 10,
        baseDeuterium: 0,
      });
    const credentials = buildTestUser();
    username = credentials.username;
    const registered = await request(app.getHttpServer())
      .post("/auth/register")
      .send(credentials)
      .expect(201);
    token = registered.body.tokens.accessToken;
    const user = await database.user.findUniqueOrThrow({
      where: { username },
      include: { planets: true },
    });
    userId = user.id;
    planetId = user.planets[0].id;
  });
  afterAll(async () => {
    jest.useRealTimers();
    if (username) await cleanupTestUser(database, username);
    await app?.close();
    await isolated?.drop();
  });
  beforeEach(async () => {
    base = Date.now();
    await database.buildQueue.deleteMany({ where: { planetId } });
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 500,
        crystal: 500,
        deuterium: 0,
        metalMine: 0,
        crystalMine: 0,
        deuteriumMine: 0,
        solarPlant: 0,
        fieldsUsed: 0,
        lastUpdate: new Date(base),
      },
    });
  });
  afterEach(() => jest.restoreAllMocks());

  async function complete(buildingId: number) {
    const started = await request(app.getHttpServer())
      .post(`/planets/${planetId}/build`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId })
      .expect(201);
    const queue = await database.buildQueue.findFirstOrThrow({
      where: { planetId, completed: false },
    });
    const clock = jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date(started.body.endTime).getTime());
    // new Date() reste réel ici ; le service emploie Date.now() pour sa borne de production.
    await app.get(BuildingsService).completeConstruction(queue);
    const planet = await database.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    clock.mockRestore();
    return {
      planet,
      queue,
      elapsed: (new Date(started.body.endTime).getTime() - base) / 1000,
    };
  }

  it("une mine ne produit pas pendant sa construction et sa finalisation est idempotente", async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { solarPlant: 1 },
    });
    const { planet, queue, elapsed } = await complete(1);
    expect(planet.metal).toBeCloseTo(500 - 60 + (20 * elapsed) / 3600, 7);
    expect(planet.crystal).toBeCloseTo(500 - 15 + (10 * elapsed) / 3600, 7);
    expect(planet.metalProduction).toBeCloseTo(53);
    expect(planet.energyUsed).toBe(11);
    await app.get(BuildingsService).completeConstruction(queue);
    const repeated = await database.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    expect(repeated.metal).toBe(planet.metal);
    expect(repeated.fieldsUsed).toBe(1);
  });

  it("une centrale ne réactive pas les mines rétroactivement", async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { metalMine: 1 },
    });
    const { planet, elapsed } = await complete(4);
    expect(planet.metal).toBeCloseTo(500 - 75 + (20 * elapsed) / 3600, 7);
    expect(planet.metalProduction).toBeCloseTo(53);
    expect(planet.energyAvailable).toBe(22);
  });

  it("le déficit créé par un synthétiseur ne réduit pas la production déjà gagnée", async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { metalMine: 1, crystalMine: 1, solarPlant: 1 },
    });
    const { planet, elapsed } = await complete(3);
    expect(planet.metal).toBeCloseTo(500 - 225 + (53 * elapsed) / 3600, 7);
    expect(planet.crystal).toBeCloseTo(500 - 75 + (32 * elapsed) / 3600, 7);
    expect(planet.deuterium).toBe(0);
    expect(planet.metalProduction).toBeCloseTo(36.5);
    expect(planet.deuteriumProduction).toBeCloseTo(5.5);
    expect(planet.energyUsed).toBe(44);
  });

  it("deux finalisations simultanées conservent la production et les cases", async () => {
    await database.planet.update({
      where: { id: planetId },
      data: { solarPlant: 1 },
    });
    const building = app.get(BuildingsService);
    await Promise.all([
      building.startConstruction(planetId, 1, userId),
      building.startConstruction(planetId, 2, userId),
    ]);
    const queues = await database.buildQueue.findMany({
      where: { planetId, completed: false },
    });
    const now = Math.max(...queues.map((queue) => queue.endTime.getTime()));
    jest.spyOn(Date, "now").mockReturnValue(now);
    await Promise.all(
      queues.map((queue) => building.completeConstruction(queue)),
    );
    const planet = await database.planet.findUniqueOrThrow({
      where: { id: planetId },
    });
    expect(planet.metal).toBeCloseTo(
      500 - 60 - 48 + (20 * (now - base)) / 3600000,
      7,
    );
    expect(planet.crystal).toBeCloseTo(
      500 - 15 - 24 + (10 * (now - base)) / 3600000,
      7,
    );
    expect(planet.fieldsUsed).toBe(2);
    expect(planet.metalProduction).toBeCloseTo(53);
    expect(planet.crystalProduction).toBeCloseTo(32);
    expect(planet.energyUsed).toBe(22);
  });
});
