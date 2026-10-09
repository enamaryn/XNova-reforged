import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { io, Socket } from "socket.io-client";
import request from "supertest";
import { AdminService } from "../../src/admin/admin.service";
import { DatabaseService } from "../../src/database/database.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
} from "./helpers";

/**
 * SEC-03 — sessions serveur, rotation des refresh tokens, révocation et bannissement.
 */
describe("API integration - Sessions, rotation et bannissement (SEC-03)", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let admin: AdminService;
  let port: number;
  let adminId: string;

  const created: string[] = [];
  const sockets: Socket[] = [];

  const server = () => app.getHttpServer();

  const signUp = async () => {
    const user = buildTestUser();
    created.push(user.username);
    const res = await request(server())
      .post("/auth/register")
      .send(user)
      .expect(201);
    return {
      user,
      userId: res.body.user.id as string,
      access: res.body.tokens.accessToken as string,
      refresh: res.body.tokens.refreshToken as string,
    };
  };

  const me = (token: string) =>
    request(server()).get("/auth/me").set("Authorization", `Bearer ${token}`);

  const refresh = (refreshToken: string) =>
    request(server()).post("/auth/refresh").send({ refreshToken });

  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`http://127.0.0.1:${port}/game`, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
      });
      sockets.push(socket);
      socket.on("connected", () => resolve(socket));
      socket.on("connect_error", reject);
      socket.on("disconnect", () => reject(new Error("connexion refusee")));
      setTimeout(() => reject(new Error("timeout connexion")), 5000);
    });

  const waitDisconnect = (socket: Socket) =>
    new Promise<boolean>((resolve) => {
      if (socket.disconnected) return resolve(true);
      socket.once("disconnect", () => resolve(true));
      setTimeout(() => resolve(false), 3000);
    });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    admin = app.get(AdminService);
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;

    const actor = buildTestUser();
    created.push(actor.username);
    const res = await request(server())
      .post("/auth/register")
      .send(actor)
      .expect(201);
    adminId = res.body.user.id;
    await database.user.update({
      where: { id: adminId },
      data: { role: "ADMIN" },
    });
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    for (const username of created) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  it("rotation : le refresh token est à usage unique et le rejeu coupe la session", async () => {
    const s = await signUp();

    const first = await refresh(s.refresh).expect(200);
    expect(first.body.refreshToken).toBeTruthy();
    expect(first.body.refreshToken).not.toBe(s.refresh);
    await me(first.body.accessToken).expect(200);

    // Rejeu de l'ancien refresh token : refusé, et la session entière est révoquée
    await refresh(s.refresh).expect(401);
    await refresh(first.body.refreshToken).expect(401);
    await me(first.body.accessToken).expect(401);
    await me(s.access).expect(401);
  });

  it("déconnexion : révoque la session serveur, le refresh et coupe les sockets", async () => {
    const s = await signUp();
    const socket = await connect(s.access);

    await request(server())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${s.access}`)
      .expect(200);

    await me(s.access).expect(401);
    await refresh(s.refresh).expect(401);
    expect(await waitDisconnect(socket)).toBe(true);
    await expect(connect(s.access)).rejects.toBeDefined();
  });

  it("bannissement : jetons, refresh, connexion et socket ouvert sont refusés", async () => {
    const s = await signUp();
    const socket = await connect(s.access);
    await me(s.access).expect(200);

    await admin.banUser(adminId, {
      username: s.user.username,
      hours: 1,
    } as any);

    await me(s.access).expect(401);
    await refresh(s.refresh).expect(401);
    await request(server())
      .post("/auth/login")
      .send({ identifier: s.user.username, password: s.user.password })
      .expect(401);
    expect(await waitDisconnect(socket)).toBe(true);

    // Levée du bannissement : nouvelle connexion possible, anciens jetons toujours morts
    await admin.unbanUser(adminId, { username: s.user.username } as any);
    const login = await request(server())
      .post("/auth/login")
      .send({ identifier: s.user.username, password: s.user.password })
      .expect(200);
    await me(login.body.tokens.accessToken).expect(200);
    await me(s.access).expect(401);
  });

  it("bannissement posé hors API admin : le jeton existant est refusé sans révocation explicite", async () => {
    const s = await signUp();
    await database.user.update({
      where: { id: s.userId },
      data: { bannedAt: new Date(), bannedUntil: null },
    });

    await me(s.access).expect(401);
    await refresh(s.refresh).expect(401);
  });

  it("expiration : une session expirée est refusée", async () => {
    const s = await signUp();
    await database.session.updateMany({
      where: { userId: s.userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await me(s.access).expect(401);
    await refresh(s.refresh).expect(401);
  });

  it("un jeton sans session (ancien format) ou signé pour une autre session est refusé", async () => {
    const s = await signUp();
    const other = await signUp();
    const jwt = app.get(JwtService);
    const secret = process.env.JWT_SECRET as string;

    const legacy = jwt.sign(
      { sub: s.userId, username: s.user.username },
      { secret },
    );
    await me(legacy).expect(401);

    const sessionOfOther = await database.session.findFirstOrThrow({
      where: { userId: other.userId },
    });
    const mismatch = jwt.sign(
      { sub: s.userId, username: s.user.username, sid: sessionOfOther.id },
      { secret },
    );
    await me(mismatch).expect(401);
  });
});
