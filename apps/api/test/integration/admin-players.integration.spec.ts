import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomBytes } from "crypto";
import { DatabaseService } from "../../src/database/database.service";
import { MailService } from "../../src/mail/mail.service";
import {
  acquireGlobalLock,
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";
import { FakeSmtp, extractToken } from "./fake-smtp";

describe("Administration des joueurs", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let adminToken: string;
  const usernames: string[] = [];
  const smtp = new FakeSmtp();
  let release: () => void = () => undefined;
  const server = () => app.getHttpServer();
  const account = async (role: "PLAYER" | "ADMIN" | "MODERATOR" = "PLAYER") => {
    const credentials = buildTestUser();
    usernames.push(credentials.username);
    const tokens = await registerAndLogin(app, credentials);
    const refreshed = await request(server())
      .post("/auth/login")
      .send({
        identifier: credentials.username,
        password: credentials.password,
      })
      .expect(200);
    const user = await database.user.update({
      where: { username: credentials.username },
      data: { role },
    });
    await smtp.waitFor(credentials.email);
    return {
      ...credentials,
      ...tokens,
      refreshToken: refreshed.body.tokens.refreshToken,
      id: user.id,
    };
  };
  beforeAll(async () => {
    release = await acquireGlobalLock("smtp-config");
    ({ app, database } = await createIntegrationApp());
    await smtp.start();
    const settings = {
      enabled: "true",
      host: "127.0.0.1",
      port: String(smtp.port),
      secure: "false",
      fromEmail: "admin@example.test",
    };
    for (const [field, value] of Object.entries(settings)) {
      const key = `smtp.${field}`;
      await database.gameConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    adminToken = (await account("ADMIN")).accessToken;
  }, 180000);
  afterAll(async () => {
    await database.gameConfig.deleteMany({
      where: { key: { startsWith: "smtp." } },
    });
    await smtp.stop();
    for (const username of usernames) await cleanupTestUser(database, username);
    await app?.close();
    release();
  });

  it("liste paginée, recherche insensible à la casse et fiche sans secrets", async () => {
    const prefix = `pl_${randomBytes(4).toString("hex")}`;
    const rows = Array.from({ length: 26 }, (_, index) => ({
      username: `${prefix}_${String(index).padStart(2, "0")}`,
      email: `${prefix}_${index}@example.test`,
      password: "never-expose-this",
      points: index * 100,
    }));
    usernames.push(...rows.map((row) => row.username));
    await database.user.createMany({ data: rows });
    const first = await request(server())
      .get("/admin/players")
      .query({ search: prefix.toUpperCase() })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(first.body.total).toBe(26);
    expect(first.body.players).toHaveLength(25);
    const second = await request(server())
      .get("/admin/players")
      .query({ search: prefix, page: 2 })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(second.body.players).toHaveLength(1);
    expect(
      first.body.players.some(
        (player: { id: string }) => player.id === second.body.players[0].id,
      ),
    ).toBe(false);
    expect(JSON.stringify(first.body)).not.toContain("never-expose-this");
    await request(server())
      .get("/admin/players?page=0")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    const player = await account();
    const planet = await database.planet.findFirstOrThrow({
      where: { userId: player.id },
    });
    await database.planet.update({
      where: { id: planet.id },
      data: {
        crystalMine: 4,
        solarPlant: 10,
        metal: 123000,
        lastUpdate: new Date(),
      },
    });
    const detail = await request(server())
      .get(`/admin/players/${player.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(
      detail.body.planets[0].buildings.find(
        (building: { id: number }) => building.id === 2,
      ).level,
    ).toBe(4);
    expect(detail.body.planets[0].resources.metal).toBeGreaterThanOrEqual(
      123000,
    );
    expect(detail.body.technologies).not.toHaveLength(0);
    expect(detail.body).not.toHaveProperty("password");
    expect(detail.body).not.toHaveProperty("sessions");
    expect(detail.body).not.toHaveProperty("emailTokens");
  });

  it("refuse les joueurs ordinaires ; un modérateur peut lire mais pas changer l’email", async () => {
    const player = await account();
    const moderator = await account("MODERATOR");
    await request(server())
      .get("/admin/players")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(403);
    await request(server())
      .get(`/admin/players/${player.id}`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(403);
    await request(server())
      .get("/admin/players")
      .set("Authorization", `Bearer ${moderator.accessToken}`)
      .expect(200);
    await request(server())
      .put(`/admin/players/${player.id}/email`)
      .set("Authorization", `Bearer ${moderator.accessToken}`)
      .send({ email: "forbidden@example.test" })
      .expect(403);
    await database.user.update({
      where: { id: player.id },
      data: { role: "SUPER_ADMIN" },
    });
    await request(server())
      .put(`/admin/players/${player.id}/email`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "forbidden@example.test" })
      .expect(403);
  });

  it("changer l’email déconnecte et impose une nouvelle confirmation, même en développement", async () => {
    const player = await account();
    const previousToken = extractToken(await smtp.waitFor(player.email));
    await request(server())
      .post("/auth/verify-email")
      .send({ token: previousToken })
      .expect(200);
    const newEmail = `new_${player.email}`;
    await request(server())
      .put(`/admin/players/${player.id}/email`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: newEmail })
      .expect(200);
    const user = await database.user.findUniqueOrThrow({
      where: { id: player.id },
    });
    expect(user.email).toBe(newEmail);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.mustVerifyEmail).toBe(true);
    await request(server())
      .get("/auth/me")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .expect(401);
    await request(server())
      .post("/auth/refresh")
      .send({ refreshToken: player.refreshToken })
      .expect(401);
    const login = await request(server())
      .post("/auth/login")
      .send({ identifier: player.username, password: player.password })
      .expect(403);
    expect(login.body.code).toBe("EMAIL_NOT_VERIFIED");
    await request(server())
      .post("/auth/verify-email")
      .send({ token: previousToken })
      .expect(400);
    const token = extractToken(await smtp.waitFor(newEmail));
    await request(server())
      .post("/auth/verify-email")
      .send({ token })
      .expect(200);
    await request(server())
      .post("/auth/verify-email")
      .send({ token })
      .expect(400);
    await request(server())
      .post("/auth/login")
      .send({ identifier: newEmail, password: player.password })
      .expect(200);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: player.id } }))
        .mustVerifyEmail,
    ).toBe(false);
    const audit = await database.adminAuditLog.findFirstOrThrow({
      where: {
        action: "update_player_email",
        userId: (
          await database.user.findFirstOrThrow({
            where: { role: "ADMIN", username: { in: usernames } },
          })
        ).id,
      },
    });
    expect(JSON.stringify(audit.changes)).not.toContain(token);
  });

  it("refuse un email invalide ou déjà utilisé et conserve l’ancien état si SMTP échoue", async () => {
    const player = await account();
    const other = await account();
    const route = `/admin/players/${player.id}/email`;
    await request(server())
      .put(route)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "invalid" })
      .expect(400);
    await request(server())
      .put(route)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: other.email.toUpperCase() })
      .expect(409);
    const mail = jest
      .spyOn(app.get(MailService), "send")
      .mockRejectedValueOnce(new Error("SMTP indisponible"));
    try {
      await request(server())
        .put(route)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: `failure_${player.email}` })
        .expect(500);
      expect(
        (await database.user.findUniqueOrThrow({ where: { id: player.id } }))
          .email,
      ).toBe(player.email);
      await request(server())
        .get("/auth/me")
        .set("Authorization", `Bearer ${player.accessToken}`)
        .expect(200);
    } finally {
      mail.mockRestore();
    }
  });

  it("bannir et débannir se reflètent dans la liste et bloquent/rétablissent la connexion", async () => {
    const player = await account();
    await request(server())
      .put("/admin/ban")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: player.username })
      .expect(200);
    const list = await request(server())
      .get("/admin/players")
      .query({ search: player.username })
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.players[0].banned).toBe(true);
    expect(list.body.players[0].bannedUntil).toBeNull();
    await request(server())
      .post("/auth/login")
      .send({ identifier: player.username, password: player.password })
      .expect(401);
    await request(server())
      .put("/admin/unban")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: player.username })
      .expect(200);
    await request(server())
      .post("/auth/login")
      .send({ identifier: player.username, password: player.password })
      .expect(200);
  });
});
