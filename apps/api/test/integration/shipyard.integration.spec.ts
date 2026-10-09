import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { DatabaseService } from "../../src/database/database.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";

describe("API integration - Chantier Spatial (Shipyard)", () => {
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("liste le chantier spatial et construit des vaisseaux", async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);
    expect(accessToken).toBeTruthy();

    const server = app.getHttpServer();

    // Récupérer la planète du joueur
    const meResponse = await request(server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;
    expect(planetId).toBeTruthy();

    // Donner des ressources et un chantier spatial au joueur
    await database.planet.update({
      where: { id: planetId },
      data: {
        metal: 100000,
        crystal: 100000,
        deuterium: 50000,
        shipyard: 2, // Niveau 2 pour construire des vaisseaux basiques
      },
    });
    // Prérequis du petit transporteur : technologie Réacteur à combustion niveau 2
    await database.technology.upsert({
      where: { userId_techId: { userId: meResponse.body.id, techId: 115 } },
      update: { level: 2 },
      create: { userId: meResponse.body.id, techId: 115, level: 2 },
    });

    // GET /shipyard - Liste des vaisseaux constructibles
    const shipyardResponse = await request(server)
      .get("/shipyard")
      .query({ planetId })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(shipyardResponse.body).toBeDefined();

    // POST /shipyard/build - Construire un petit transporteur (ID 202)
    const buildResponse = await request(server)
      .post("/shipyard/build")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planetId, shipId: 202, amount: 1 });

    // Scénario nominal : succès exact exigé, puis toutes les étapes (file, annulation, file vide)
    expect(buildResponse.status).toBe(201);
    {
      const queueId = buildResponse.body?.queueId;
      expect(queueId).toBeTruthy();

      // GET /shipyard/queue - Voir la file d'attente
      const queueResponse = await request(server)
        .get("/shipyard/queue")
        .query({ planetId })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(queueResponse.body)).toBe(true);
      expect(queueResponse.body.length).toBeGreaterThan(0);

      // A started lot cannot be cancelled. A second lot waits and refunds 90 %.
      await request(server)
        .delete(`/shipyard/queue/${queueId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);
      await database.shipQueue.update({
        where: { id: queueId },
        data: { endTime: new Date(Date.now() + 600000) },
      });
      const waiting = await request(server)
        .post("/shipyard/build")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ planetId, shipId: 202, amount: 1 })
        .expect(201);
      const removed = await request(server)
        .delete(`/shipyard/queue/${waiting.body.queueId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(removed.body.refund).toEqual({
        metal: 1800,
        crystal: 1800,
        deuterium: 0,
      });
      expect(
        await database.shipQueue.count({
          where: { planetId, completed: false },
        }),
      ).toBe(1);
    }

    await cleanupTestUser(database, testUser.username);
  });

  it("refuse construction sans chantier spatial", async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    const meResponse = await request(server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;

    // S'assurer que le chantier est au niveau 0
    await database.planet.update({
      where: { id: planetId },
      data: { shipyard: 0 },
    });

    // Tenter de construire (devrait échouer)
    const buildResponse = await request(server)
      .post("/shipyard/build")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planetId, shipId: 202, amount: 1 });

    expect(buildResponse.status).toBe(400);
    expect(String(buildResponse.body.message)).toMatch(/Prerequis manquants/);
    expect(await database.shipQueue.count({ where: { planetId } })).toBe(0);

    await cleanupTestUser(database, testUser.username);
  });

  it("refuse construction sans ressources suffisantes", async () => {
    const testUser = buildTestUser();
    const { accessToken } = await registerAndLogin(app, testUser);

    const server = app.getHttpServer();

    const meResponse = await request(server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const planetId = meResponse.body?.planets?.[0]?.id;

    // Mettre le chantier au niveau 2 mais pas de ressources
    await database.planet.update({
      where: { id: planetId },
      data: {
        shipyard: 2,
        metal: 0,
        crystal: 0,
        deuterium: 0,
      },
    });
    // Prérequis satisfaits : seul le manque de ressources doit justifier le refus
    await database.technology.upsert({
      where: { userId_techId: { userId: meResponse.body.id, techId: 115 } },
      update: { level: 2 },
      create: { userId: meResponse.body.id, techId: 115, level: 2 },
    });

    // Tenter de construire (devrait échouer)
    const buildResponse = await request(server)
      .post("/shipyard/build")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planetId, shipId: 202, amount: 1 });

    expect(buildResponse.status).toBe(400);
    expect(String(buildResponse.body.message)).toMatch(
      /Ressources insuffisantes/,
    );
    expect(await database.shipQueue.count({ where: { planetId } })).toBe(0);

    await cleanupTestUser(database, testUser.username);
  });
});
