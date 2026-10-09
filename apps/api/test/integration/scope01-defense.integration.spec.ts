import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SHIPS } from "@xnova/game-config";
import { simulateCombat } from "@xnova/game-engine";
import { DatabaseService } from "../../src/database/database.service";
import { CombatService } from "../../src/combat/combat.service";
import { FleetCronService } from "../../src/fleet/fleet-cron.service";
import { ShipyardService } from "../../src/shipyard/shipyard.service";
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from "./helpers";

/**
 * SCOPE-01 — défense : catalogue, construction (file partagée avec le chantier), prérequis,
 * boucliers uniques, participation au combat, pertes et réparations.
 */
describe("API integration - Défense (SCOPE-01)", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let cron: any;

  type Player = {
    token: string;
    userId: string;
    planetId: string;
    galaxy: number;
    system: number;
    position: number;
  };

  const usernames: string[] = [];
  let builder: Player;
  let attacker: Player;
  let owner: Player;

  const server = () => app.getHttpServer();
  const past = (seconds: number) => new Date(Date.now() - seconds * 1000);

  const signUp = async (): Promise<Player> => {
    const user = buildTestUser();
    usernames.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(server())
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const planet = me.body.planets[0];
    return {
      token: accessToken,
      userId: me.body.id,
      planetId: planet.id,
      galaxy: planet.galaxy,
      system: planet.system,
      position: planet.position,
    };
  };

  const auth = (player: Player) => ({
    Authorization: `Bearer ${player.token}`,
  });

  const buildDefense = (player: Player, defenseId: number, amount: number) =>
    request(server())
      .post("/defense/build")
      .set(auth(player))
      .send({ planetId: player.planetId, defenseId, amount });

  const catalog = async (player: Player) =>
    (
      await request(server())
        .get(`/defense?planetId=${player.planetId}`)
        .set(auth(player))
        .expect(200)
    ).body;

  const defenseAmount = async (planetId: string, defenseId: number) =>
    (
      await database.defense.findUnique({
        where: { planetId_defenseId: { planetId, defenseId } },
      })
    )?.amount ?? 0;

  const setDefense = (planetId: string, defenseId: number, amount: number) =>
    database.defense.upsert({
      where: { planetId_defenseId: { planetId, defenseId } },
      update: { amount },
      create: { planetId, defenseId, amount },
    });

  const setShips = async (planetId: string, ships: Record<number, number>) => {
    await database.ship.deleteMany({ where: { planetId } });
    for (const [shipId, amount] of Object.entries(ships)) {
      await database.ship.create({
        data: { planetId, shipId: Number(shipId), amount },
      });
    }
  };

  const freePosition = async (galaxy: number, system: number) => {
    for (let position = 1; position <= 15; position += 1) {
      const taken = await database.planet.findUnique({
        where: { galaxy_system_position: { galaxy, system, position } },
      });
      if (!taken) return { galaxy, system, position };
    }
    throw new Error("zone de test saturée");
  };

  /** Envoie une attaque de l'attaquant vers la planète du propriétaire, arrivée immédiate, puis la résout. */
  const attack = async (
    ships: Record<number, number>,
    random: number | null,
  ) => {
    await setShips(attacker.planetId, ships);
    const res = await request(server())
      .post("/fleet/send")
      .set(auth(attacker))
      .send({
        planetId: attacker.planetId,
        toGalaxy: owner.galaxy,
        toSystem: owner.system,
        toPosition: owner.position,
        mission: 1,
        speedPercent: 100,
        ships,
        cargo: {},
      })
      .expect(201);
    await database.fleet.update({
      where: { id: res.body.fleetId },
      data: { arrivalTime: past(60), returnTime: past(10) },
    });
    const spy =
      random === null
        ? null
        : jest.spyOn(Math, "random").mockReturnValue(random);
    try {
      await cron.processArrivals();
    } finally {
      spy?.mockRestore();
    }
    return database.combatReport.findFirstOrThrow({
      where: { attackerId: attacker.userId },
      orderBy: { createdAt: "desc" },
    });
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    cron = app.get(FleetCronService);
    builder = await signUp();
    attacker = await signUp();
    owner = await signUp();
    // Propriétaire dans le même système que l'attaquant : carburant négligeable
    const near = await freePosition(attacker.galaxy, attacker.system);
    await database.planet.update({ where: { id: owner.planetId }, data: near });
    Object.assign(owner, near);
    for (const p of [builder, attacker, owner]) {
      await database.planet.update({
        where: { id: p.planetId },
        data: {
          metal: 5_000_000,
          crystal: 5_000_000,
          deuterium: 5_000_000,
          lastUpdate: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    for (const username of usernames) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  describe("catalogue et prérequis", () => {
    it("liste les huit défenses, sans missiles, avec prérequis manquants", async () => {
      const body = await catalog(builder);
      expect(body.defenses.map((d: any) => d.id)).toEqual([
        401, 402, 403, 404, 405, 406, 407, 408,
      ]);
      const launcher = body.defenses.find((d: any) => d.id === 401);
      expect(launcher.canBuild).toBe(false); // chantier spatial niveau 0
      expect(launcher.missingRequirements.join(" ")).toMatch(/niveau 1 requis/);
    });

    it("refuse sans chantier spatial, sans débit ni file", async () => {
      await database.planet.update({
        where: { id: builder.planetId },
        data: { shipyard: 0 },
      });
      const before = await database.planet.findUniqueOrThrow({
        where: { id: builder.planetId },
      });
      const res = await buildDefense(builder, 401, 1).expect(400);
      expect(res.body.message).toMatch(/Prerequis manquants/);
      const after = await database.planet.findUniqueOrThrow({
        where: { id: builder.planetId },
      });
      expect(after.metal).toBe(before.metal);
      expect(
        await database.shipQueue.count({
          where: { planetId: builder.planetId },
        }),
      ).toBe(0);
    });

    it("refuse les missiles, les identifiants inconnus et les vaisseaux sur la route défense", async () => {
      await database.planet.update({
        where: { id: builder.planetId },
        data: { shipyard: 8, missileSilo: 1 },
      });
      for (const id of [502, 503, 999, 202]) {
        await buildDefense(builder, id, 1).expect(400);
      }
      expect(
        await database.shipQueue.count({
          where: { planetId: builder.planetId },
        }),
      ).toBe(0);
    });

    it("la route chantier refuse un identifiant de défense", async () => {
      await request(server())
        .post("/shipyard/build")
        .set(auth(builder))
        .send({ planetId: builder.planetId, shipId: 401, amount: 1 })
        .expect(400);
      expect(
        await database.shipQueue.count({
          where: { planetId: builder.planetId },
        }),
      ).toBe(0);
    });

    it("refuse la planète d'un autre joueur et exige une authentification", async () => {
      await request(server())
        .post("/defense/build")
        .set(auth(attacker))
        .send({ planetId: builder.planetId, defenseId: 401, amount: 1 })
        .expect(403);
      await request(server())
        .get(`/defense?planetId=${builder.planetId}`)
        .set(auth(attacker))
        .expect(403);
      await request(server())
        .get(`/defense?planetId=${builder.planetId}`)
        .expect(401);
    });
  });

  describe("construction", () => {
    beforeEach(async () => {
      await database.shipQueue.deleteMany({
        where: { planetId: builder.planetId },
      });
      await database.defense.deleteMany({
        where: { planetId: builder.planetId },
      });
      await database.planet.update({
        where: { id: builder.planetId },
        data: {
          shipyard: 8,
          metal: 5_000_000,
          crystal: 5_000_000,
          deuterium: 5_000_000,
        },
      });
    });

    it("débite le coût, met en file, puis crédite la défense à la fin ; une seule fois", async () => {
      const before = await database.planet.findUniqueOrThrow({
        where: { id: builder.planetId },
      });
      const res = await buildDefense(builder, 401, 10).expect(201);
      expect(res.body.cost).toEqual({ metal: 20000, crystal: 0, deuterium: 0 });

      const after = await database.planet.findUniqueOrThrow({
        where: { id: builder.planetId },
      });
      expect(before.metal - after.metal).toBeGreaterThanOrEqual(20000);
      expect(await defenseAmount(builder.planetId, 401)).toBe(0);

      const queue = await request(server())
        .get(`/shipyard/queue?planetId=${builder.planetId}`)
        .set(auth(builder))
        .expect(200);
      expect(queue.body).toHaveLength(1);
      expect(queue.body[0]).toMatchObject({
        shipId: 401,
        amount: 10,
        kind: "defense",
      });

      const shipyard = app.get(ShipyardService);
      const entry = await database.shipQueue.findFirstOrThrow({
        where: { planetId: builder.planetId },
      });
      await database.shipQueue.update({
        where: { id: entry.id },
        data: { endTime: new Date(Date.now() - 1000) },
      });
      await Promise.all([
        shipyard.completeBuild(entry),
        shipyard.completeBuild(entry),
      ]);
      expect(await defenseAmount(builder.planetId, 401)).toBe(10);

      const listed = (await catalog(builder)).defenses.find(
        (d: any) => d.id === 401,
      );
      expect(listed.currentAmount).toBe(10);
    });

    it("le retrait en attente rembourse 90 % du montant débité", async () => {
      const before = await database.planet.findUniqueOrThrow({
        where: { id: builder.planetId },
      });
      await buildDefense(builder, 401, 100).expect(201);
      const res = await buildDefense(builder, 401, 4).expect(201);
      const cancel = await request(server())
        .delete(`/shipyard/queue/${res.body.queueId}`)
        .set(auth(builder))
        .expect(200);
      expect(cancel.body.refund).toEqual({
        metal: 7200,
        crystal: 0,
        deuterium: 0,
      });
      const after = await database.planet.findUniqueOrThrow({
        where: { id: builder.planetId },
      });
      expect(Math.floor(after.metal)).toBeGreaterThanOrEqual(
        Math.floor(before.metal - 200000 - 800),
      );
      expect(
        await database.shipQueue.count({
          where: { planetId: builder.planetId },
        }),
      ).toBe(1);
    });

    it("ressources insuffisantes : refus sans file", async () => {
      await database.planet.update({
        where: { id: builder.planetId },
        data: { metal: 100 },
      });
      await buildDefense(builder, 401, 1).expect(400);
      expect(
        await database.shipQueue.count({
          where: { planetId: builder.planetId },
        }),
      ).toBe(0);
    });

    it("bouclier : un seul exemplaire, y compris en file ou en cas de demandes simultanées", async () => {
      await database.technology.upsert({
        where: { userId_techId: { userId: builder.userId, techId: 111 } },
        update: { level: 2 },
        create: { userId: builder.userId, techId: 111, level: 2 },
      });
      await buildDefense(builder, 407, 2).expect(400);
      const results = await Promise.all([
        buildDefense(builder, 407, 1),
        buildDefense(builder, 407, 1),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      expect(
        await database.shipQueue.count({
          where: { planetId: builder.planetId, shipId: 407 },
        }),
      ).toBe(1);
      const listed = (await catalog(builder)).defenses.find(
        (d: any) => d.id === 407,
      );
      expect(listed.canBuild).toBe(false);
      expect(listed.missingRequirements.join(" ")).toMatch(/Une seule unité/);
    });
  });

  describe("combat", () => {
    beforeEach(async () => {
      await database.combatReport.deleteMany({
        where: { attackerId: attacker.userId },
      });
      await database.fleet.deleteMany({ where: { userId: attacker.userId } });
      await database.defense.deleteMany({
        where: { planetId: owner.planetId },
      });
      await setShips(owner.planetId, {});
      await database.technology.deleteMany({
        where: { userId: { in: [attacker.userId, owner.userId] } },
      });
    });

    it("le moteur fait combattre les défenses (sans elles, la même flotte gagne)", () => {
      const tech = { weapon: 0, shield: 0, armor: 0 };
      const withoutDefense = simulateCombat({
        attackerShips: { 204: 20 },
        defenderShips: {},
        attackerTech: tech,
        defenderTech: tech,
      });
      expect(withoutDefense.result).toBe("attacker_win");

      const withDefense = simulateCombat({
        attackerShips: { 204: 20 },
        defenderShips: { 406: 20 },
        attackerTech: tech,
        defenderTech: tech,
      });
      expect(withDefense.result).toBe("defender_win");
      expect(withDefense.attackerRemaining).toEqual({});
      // Les défenses ne laissent pas de débris
      expect(withDefense.debris.metal).toBe(
        Math.floor(
          withDefense.attackerLosses[204] * SHIPS[204].cost.metal * 0.3,
        ),
      );
    });

    it("les défenses repoussent l'attaque et le rapport les enregistre", async () => {
      await setDefense(owner.planetId, 406, 20);
      const report = await attack({ 204: 5 }, null);
      expect(report.result).toBe("defender_win");
      expect(report.defenderDefs).toEqual({ "406": 20 });
      expect(report.attackerLosses).toEqual({ "204": 5 });
      expect(
        await database.fleet.count({
          where: { userId: attacker.userId, status: "returning" },
        }),
      ).toBe(0);
    });

    it("défenses détruites et non réparées : stock décrémenté, rapport sans réparation", async () => {
      await setDefense(owner.planetId, 401, 5);
      // random = 0.99 : aucune réparation (0.99 >= 0.7)
      const report = await attack({ 206: 200 }, 0.99);
      expect(report.result).toBe("attacker_win");
      expect(report.defenderLosses).toMatchObject({ "401": 5 });
      expect(report.defenderRepaired).toEqual({});
      expect(await defenseAmount(owner.planetId, 401)).toBe(0);
    });

    it("défenses détruites puis réparées : stock conservé, réparations tracées", async () => {
      await setDefense(owner.planetId, 401, 5);
      // random = 0 : toutes les défenses détruites sont réparées
      const report = await attack({ 206: 200 }, 0);
      expect(report.defenderLosses).toMatchObject({ "401": 5 });
      expect(report.defenderRepaired).toEqual({ "401": 5 });
      expect(await defenseAmount(owner.planetId, 401)).toBe(5);
    });

    it("la flotte stationnée perdue n'est jamais réparée", async () => {
      await setShips(owner.planetId, { 204: 10 });
      const report = await attack({ 206: 200 }, 0);
      expect(report.defenderLosses).toMatchObject({ "204": 10 });
      const ship = await database.ship.findUnique({
        where: { planetId_shipId: { planetId: owner.planetId, shipId: 204 } },
      });
      expect(ship?.amount ?? 0).toBe(0);
    });

    it("la réparation suit le facteur de la configuration (statistique)", () => {
      const service = app.get(CombatService) as any;
      const result = service.repairDefenses({ 401: 20000 });
      expect(result[401]).toBeGreaterThan(13000);
      expect(result[401]).toBeLessThan(15000);
    });
  });

  describe("espionnage", () => {
    it("le rapport de niveau 2 révèle les défenses", async () => {
      await setDefense(owner.planetId, 402, 3);
      await database.technology.upsert({
        where: { userId_techId: { userId: attacker.userId, techId: 106 } },
        update: { level: 3 },
        create: { userId: attacker.userId, techId: 106, level: 3 },
      });
      await setShips(attacker.planetId, { 210: 3 });
      const res = await request(server())
        .post("/fleet/send")
        .set(auth(attacker))
        .send({
          planetId: attacker.planetId,
          toGalaxy: owner.galaxy,
          toSystem: owner.system,
          toPosition: owner.position,
          mission: 6,
          speedPercent: 100,
          ships: { "210": 3 },
          cargo: {},
        })
        .expect(201);
      await database.fleet.update({
        where: { id: res.body.fleetId },
        data: { arrivalTime: past(60), returnTime: past(10) },
      });
      await cron.processArrivals();
      const report = await database.spyReport.findFirstOrThrow({
        where: { attackerId: attacker.userId },
        orderBy: { createdAt: "desc" },
      });
      expect(report.infoLevel).toBeGreaterThanOrEqual(2);
      expect((report.data as any).defenses).toEqual({ "402": 3 });
    });
  });
});
