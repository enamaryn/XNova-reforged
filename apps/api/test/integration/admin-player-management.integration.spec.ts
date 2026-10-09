import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "crypto";
import { DatabaseService } from "../../src/database/database.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";

describe("Fiche joueur et gestion administrative", () => {
  let app: INestApplication;
  let database: DatabaseService;
  const usernames: string[] = [];
  let admin: Awaited<ReturnType<typeof account>>;
  const account = async (
    role: "PLAYER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN" = "PLAYER",
  ) => {
    const credentials = buildTestUser();
    usernames.push(credentials.username);
    const session = await registerAndLogin(app, credentials);
    const user = await database.user.update({
      where: { username: credentials.username },
      data: { role },
    });
    const home = await database.planet.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return { ...credentials, ...session, id: user.id, home };
  };
  const auth = (token = admin.accessToken) => ({
    Authorization: `Bearer ${token}`,
  });
  const payload = (username: string) => ({
    confirmationUsername: username,
    reason: "Correction demandée par le joueur",
  });
  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    admin = await account("ADMIN");
  });
  afterAll(async () => {
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  it("la fiche complète expose les unités et files, jamais les secrets, et refuse un joueur ordinaire", async () => {
    const target = await account();
    await database.ship.create({
      data: { planetId: target.home.id, shipId: 202, amount: 12 },
    });
    await database.defense.create({
      data: { planetId: target.home.id, defenseId: 401, amount: 7 },
    });
    const timing = {
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
    };
    await database.buildQueue.create({
      data: { planetId: target.home.id, buildingId: 1, level: 2, ...timing },
    });
    await database.researchQueue.create({
      data: {
        planetId: target.home.id,
        userId: target.id,
        techId: 106,
        level: 3,
        ...timing,
      },
    });
    await database.shipQueue.create({
      data: { planetId: target.home.id, shipId: 202, amount: 4, ...timing },
    });
    const response = await request(app.getHttpServer())
      .get(`/admin/players/${target.id}`)
      .set(auth())
      .expect(200);
    expect(response.body.planets[0].ships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 202, amount: 12 }),
      ]),
    );
    expect(response.body.planets[0].defenses[0].amount).toBe(7);
    expect(response.body.planets[0].buildQueue[0].level).toBe(2);
    expect(response.body.planets[0].shipQueue[0].amount).toBe(4);
    expect(response.body.researchQueue[0].level).toBe(3);
    for (const key of ["password", "sessions", "emailTokens"])
      expect(response.body).not.toHaveProperty(key);
    await request(app.getHttpServer())
      .get(`/admin/players/${target.id}`)
      .set(auth(target.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/admin/players/${target.id}`)
      .expect(401);
  });

  it("réinitialise toute la progression atomiquement, garde les accès et révoque les sessions", async () => {
    const target = await account();
    const before = await database.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    const occupied = await database.planet.findMany({
      where: { galaxy: target.home.galaxy, system: target.home.system },
      select: { position: true },
    });
    const freePosition = Array.from({ length: 15 }, (_, i) => i + 1).find(
      (position) => !occupied.some((planet) => planet.position === position),
    )!;
    const colony = await database.planet.create({
      data: {
        userId: target.id,
        name: "Colonie",
        galaxy: target.home.galaxy,
        system: target.home.system,
        position: freePosition,
      },
    });
    await database.planet.update({
      where: { id: target.home.id },
      data: {
        metalMine: 8,
        crystalMine: 9,
        solarPlant: 12,
        fieldsUsed: 29,
        metal: 1000000,
        crystal: 1000000,
      },
    });
    await database.user.update({
      where: { id: target.id },
      data: { points: 1200, rank: 5 },
    });
    await database.technology.create({
      data: { userId: target.id, techId: 106, level: 7 },
    });
    await database.ship.create({
      data: { planetId: target.home.id, shipId: 202, amount: 12 },
    });
    await database.defense.create({
      data: { planetId: colony.id, defenseId: 401, amount: 7 },
    });
    const timing = {
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
    };
    await database.buildQueue.create({
      data: { planetId: target.home.id, buildingId: 1, level: 9, ...timing },
    });
    await database.researchQueue.create({
      data: {
        planetId: colony.id,
        userId: target.id,
        techId: 106,
        level: 8,
        ...timing,
      },
    });
    await database.shipQueue.create({
      data: { planetId: colony.id, shipId: 202, amount: 4, ...timing },
    });
    await request(app.getHttpServer())
      .post(`/admin/players/${target.id}/reset`)
      .set(auth())
      .send(payload(target.username))
      .expect(201);
    const after = await database.user.findUniqueOrThrow({
      where: { id: target.id },
      include: { planets: true, technologies: true },
    });
    expect(after.planets).toHaveLength(1);
    expect(after.planets[0].id).toBe(target.home.id);
    expect(after.planets[0]).toMatchObject({
      metal: 500,
      crystal: 500,
      deuterium: 0,
      metalMine: 0,
      crystalMine: 0,
      solarPlant: 0,
      fieldsUsed: 0,
    });
    expect(after.technologies).toHaveLength(0);
    expect(after.points).toBe(0);
    expect(after.rank).toBe(0);
    expect(after.password).toBe(before.password);
    expect(after.email).toBe(before.email);
    expect(after.role).toBe(before.role);
    expect(after.emailVerifiedAt).toEqual(before.emailVerifiedAt);
    expect(after.bannedAt).toEqual(before.bannedAt);
    expect(after.planets[0]).toMatchObject({
      galaxy: target.home.galaxy,
      system: target.home.system,
      position: target.home.position,
    });
    expect(
      await database.ship.count({ where: { planetId: target.home.id } }),
    ).toBe(0);
    expect(
      await database.buildQueue.count({ where: { planetId: target.home.id } }),
    ).toBe(0);
    expect(
      await database.researchQueue.count({ where: { userId: target.id } }),
    ).toBe(0);
    expect(
      await database.shipQueue.count({ where: { planetId: colony.id } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get("/auth/me")
      .set(auth(target.accessToken))
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: target.username, password: target.password })
      .expect(200);
    const audit = await database.adminAuditLog.findFirstOrThrow({
      where: { userId: admin.id, action: "reset_player" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.changes).toMatchObject({
      targetId: target.id,
      reason: payload(target.username).reason,
    });
  });

  it("refuse mauvaise confirmation, motif absent, soi-même et rang égal ou supérieur sans effacer de données", async () => {
    const target = await account();
    const peer = await account("ADMIN");
    const superAdmin = await account("SUPER_ADMIN");
    const moderator = await account("MODERATOR");
    const url = `/admin/players/${target.id}/reset`;
    await request(app.getHttpServer())
      .post(url)
      .set(auth())
      .send(payload("autre"))
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/admin/players/${target.id}`)
      .set(auth())
      .send({ confirmationUsername: target.username })
      .expect(400);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(moderator.accessToken))
      .send(payload(target.username))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/admin/players/${admin.id}/reset`)
      .set(auth())
      .send(payload(admin.username))
      .expect(403);
    for (const protectedAccount of [peer, superAdmin]) {
      await request(app.getHttpServer())
        .delete(`/admin/players/${protectedAccount.id}`)
        .set(auth())
        .send(payload(protectedAccount.username))
        .expect(403);
      await request(app.getHttpServer())
        .put("/admin/ban")
        .set(auth())
        .send({ username: protectedAccount.username })
        .expect(403);
    }
    expect(await database.planet.count({ where: { userId: target.id } })).toBe(
      1,
    );
  });

  it("refuse reset et suppression face à une flotte entrante et conserve la flotte du tiers", async () => {
    const target = await account();
    const visitor = await account();
    const fleet = await database.fleet.create({
      data: {
        userId: visitor.id,
        fromGalaxy: visitor.home.galaxy,
        fromSystem: visitor.home.system,
        fromPosition: visitor.home.position,
        toGalaxy: target.home.galaxy,
        toSystem: target.home.system,
        toPosition: target.home.position,
        mission: 3,
        ships: { "202": 2 },
        cargo: { metal: 100 },
        status: "traveling",
        startTime: new Date(),
        arrivalTime: new Date(Date.now() + 3600000),
      },
    });
    const response = await request(app.getHttpServer())
      .get(`/admin/players/${target.id}`)
      .set(auth())
      .expect(200);
    expect(response.body.incomingFleets[0].id).toBe(fleet.id);
    await request(app.getHttpServer())
      .post(`/admin/players/${target.id}/reset`)
      .set(auth())
      .send(payload(target.username))
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/admin/players/${target.id}`)
      .set(auth())
      .send(payload(target.username))
      .expect(409);
    expect(
      await database.fleet.findUnique({ where: { id: fleet.id } }),
    ).toMatchObject({ cargo: { metal: 100 } });
    expect(
      await database.user.findUnique({ where: { id: target.id } }),
    ).not.toBeNull();
  });

  it("supprime le compte et ses données associées, conserve le tiers et journalise la suppression", async () => {
    const target = await account();
    const other = await account();
    await database.ship.create({
      data: { planetId: target.home.id, shipId: 202, amount: 12 },
    });
    await database.message.create({
      data: {
        fromId: target.id,
        toId: other.id,
        subject: "Test",
        body: "Message",
      },
    });
    await database.adminAuditLog.create({
      data: {
        userId: target.id,
        action: "previous_action",
        changes: { example: true },
      },
    });
    await request(app.getHttpServer())
      .delete(`/admin/players/${target.id}`)
      .set(auth())
      .send(payload(target.username))
      .expect(200);
    expect(
      await database.user.findUnique({ where: { id: target.id } }),
    ).toBeNull();
    expect(await database.planet.count({ where: { userId: target.id } })).toBe(
      0,
    );
    expect(await database.session.count({ where: { userId: target.id } })).toBe(
      0,
    );
    expect(
      await database.ship.count({ where: { planetId: target.home.id } }),
    ).toBe(0);
    expect(await database.message.count({ where: { fromId: target.id } })).toBe(
      0,
    );
    expect(
      await database.user.findUnique({ where: { id: other.id } }),
    ).not.toBeNull();
    await request(app.getHttpServer())
      .get("/auth/me")
      .set(auth(target.accessToken))
      .expect(401);
    const audit = await database.adminAuditLog.findFirstOrThrow({
      where: { userId: admin.id, action: "delete_player" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.changes).toMatchObject({
      targetId: target.id,
      targetUsername: target.username,
      archivedAdminLogs: [
        expect.objectContaining({
          action: "previous_action",
          changes: { example: true },
        }),
      ],
    });
    await request(app.getHttpServer())
      .get(`/admin/players/${target.id}`)
      .set(auth())
      .expect(404);
  });

  it("protège la fondation d’alliance lors de la suppression", async () => {
    const target = await account();
    const alliance = await database.alliance.create({
      data: {
        name: "Alliance test",
        tag: randomUUID().slice(0, 8),
        founderId: target.id,
      },
    });
    try {
      await request(app.getHttpServer())
        .delete(`/admin/players/${target.id}`)
        .set(auth())
        .send(payload(target.username))
        .expect(409);
      expect(
        await database.user.findUnique({ where: { id: target.id } }),
      ).not.toBeNull();
    } finally {
      await database.alliance.delete({ where: { id: alliance.id } });
    }
  });
});
