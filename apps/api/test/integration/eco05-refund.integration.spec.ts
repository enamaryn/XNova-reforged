import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { BuildingsService } from "../../src/buildings/buildings.service";
import { DatabaseService } from "../../src/database/database.service";
import { ResearchService } from "../../src/research/research.service";
import { ServerConfigService } from "../../src/server-config/server-config.service";
import { ShipyardService } from "../../src/shipyard/shipyard.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";

/**
 * ECO-05 — l'annulation rembourse exactement le montant débité,
 * quel que soit le multiplicateur de coût, même modifié après le démarrage.
 */
describe("API integration - Remboursement du montant payé (ECO-05)", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let buildings: BuildingsService;
  let research: ResearchService;
  let shipyard: ShipyardService;
  let serverConfig: ServerConfigService;
  let realGetConfig: ServerConfigService["getConfig"];

  let username: string;
  let userId: string;
  let planetId: string;

  const STOCK = 1_000_000;

  const setMultiplier = (value: number) => {
    jest
      .spyOn(serverConfig, "getConfig")
      .mockImplementation(async (force?: boolean) => ({
        ...(await realGetConfig(force)),
        buildingCostMultiplier: value,
        researchCostMultiplier: value,
        shipCostMultiplier: value,
      }));
  };

  const fresh = () =>
    database.planet.findUniqueOrThrow({ where: { id: planetId } });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    buildings = app.get(BuildingsService);
    research = app.get(ResearchService);
    shipyard = app.get(ShipyardService);
    serverConfig = app.get(ServerConfigService);
    realGetConfig = serverConfig.getConfig.bind(serverConfig);

    const testUser = buildTestUser();
    username = testUser.username;
    const { accessToken } = await registerAndLogin(app, testUser);
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    userId = me.body.id;
    planetId = me.body.planets[0].id;
    await database.technology.upsert({
      where: { userId_techId: { userId, techId: 115 } },
      update: { level: 5 },
      create: { userId, techId: 115, level: 5 },
    });
  });

  beforeEach(async () => {
    await database.buildQueue.deleteMany({ where: { planetId } });
    await database.researchQueue.deleteMany({ where: { userId } });
    await database.shipQueue.deleteMany({ where: { planetId } });
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: STOCK,
        crystal: STOCK,
        deuterium: STOCK,
        shipyard: 2,
        researchLab: 10,
        lastUpdate: new Date(),
      },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  const expectRestored = async () => {
    const after = await fresh();
    expect(after.metal).toBeCloseTo(STOCK, 4);
    expect(after.crystal).toBeCloseTo(STOCK, 4);
    expect(after.deuterium).toBeCloseTo(STOCK, 4);
  };

  describe.each([0.1, 1, 2.5])(
    "multiplicateur de départ %p",
    (startMultiplier) => {
      it("bâtiment : rembourse le débit réel après un changement de configuration", async () => {
        setMultiplier(startMultiplier);
        const started = await buildings.startConstruction(planetId, 1, userId);
        expect((await fresh()).metal).toBeLessThan(STOCK);

        setMultiplier(7);
        await buildings.cancelConstruction(started.queueId, userId);
        await expectRestored();
      });

      it("recherche : rembourse le débit réel après un changement de configuration", async () => {
        setMultiplier(startMultiplier);
        const started = await research.startResearch(planetId, 113, userId);
        expect((await fresh()).crystal).toBeLessThan(STOCK);

        setMultiplier(7);
        await research.cancelResearch(started.queueId, userId);
        await expectRestored();
      });

      it("chantier : rembourse 90 % du débit réel après un changement de configuration", async () => {
        setMultiplier(startMultiplier);
        const blocker = await shipyard.startBuild(planetId, 202, 1, userId);
        await database.shipQueue.update({
          where: { id: blocker.queueId },
          data: { endTime: new Date(Date.now() + 600000) },
        });
        const before = await fresh();
        const started = await shipyard.startBuild(planetId, 202, 3, userId);
        expect((await fresh()).metal).toBeLessThan(STOCK);

        setMultiplier(7);
        const result = await shipyard.cancelBuild(started.queueId, userId);
        expect(result.refund).toEqual({
          metal: Math.floor(started.cost.metal * 0.9),
          crystal: Math.floor(started.cost.crystal * 0.9),
          deuterium: 0,
        });
        const after = await fresh();
        expect(after.metal).toBeCloseTo(
          before.metal - started.cost.metal + result.refund.metal,
          4,
        );
        expect(after.crystal).toBeCloseTo(
          before.crystal - started.cost.crystal + result.refund.crystal,
          4,
        );
      });
    },
  );

  it("entrée antérieure sans coût enregistré : remboursement de repli sans erreur", async () => {
    setMultiplier(1);
    const started = await buildings.startConstruction(planetId, 1, userId);
    await database.$executeRaw`UPDATE "BuildQueue" SET "paidCost" = NULL WHERE "id" = ${started.queueId}`;

    const result = await buildings.cancelConstruction(started.queueId, userId);
    expect(result.success).toBe(true);
    expect((await fresh()).metal).toBeGreaterThan(STOCK - 1000);
  });
});
