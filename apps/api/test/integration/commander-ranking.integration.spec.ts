import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DatabaseService } from "../../src/database/database.service";
import { ABANDONED_USERNAME } from "@xnova/game-config";
import {
  buildTestUser,
  createIntegrationApp,
  registerAndLogin,
  useIsolatedSchema,
} from "./helpers";

describe("Rang calculé pour un serveur avec un seul joueur", () => {
  let app: INestApplication;
  let db: DatabaseService;
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;

  beforeAll(async () => {
    isolated = await useIsolatedSchema("commander_ranking");
    ({ app, database: db } = await createIntegrationApp());
  });
  afterAll(async () => {
    if (app) await app.close();
    if (isolated) await isolated.drop();
  });

  it("renvoie le rang 1 malgré les anciens champs rank et points à zéro", async () => {
    const credentials = buildTestUser();
    const { accessToken } = await registerAndLogin(app, credentials);
    const user = await db.user.findUniqueOrThrow({
      where: { username: credentials.username },
    });
    expect(
      await db.user.count({ where: { username: { not: ABANDONED_USERNAME } } }),
    ).toBe(1);
    const abandoned = await db.user.findUniqueOrThrow({
      where: { username: ABANDONED_USERNAME },
    });
    expect(
      await db.planet.count({ where: { userId: abandoned.id } }),
    ).toBeGreaterThan(1);
    expect(user.rank).toBe(0);
    expect(user.points).toBe(0);

    const { body } = await request(app.getHttpServer())
      .get("/statistics")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(body.personal.rank).toBe(1);
    expect(body.topPlayers).toHaveLength(1);
    expect(body.topPlayers[0]).toMatchObject({ id: user.id, rank: 1 });
  });
});
