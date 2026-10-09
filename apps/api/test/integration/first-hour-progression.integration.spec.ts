import { INestApplication } from "@nestjs/common";
import { writeFileSync } from "fs";
import request from "supertest";
import { DatabaseService } from "../../src/database/database.service";
import { BuildingsCronService } from "../../src/buildings/buildings-cron.service";
import { ResearchCronService } from "../../src/research/research-cron.service";
import { ResourcesCronService } from "../../src/resources/resources-cron.service";
import {
  ServerConfigService,
  ServerConfigValues,
} from "../../src/server-config/server-config.service";
import { BUILDINGS } from "@xnova/game-config";
import {
  buildTestUser,
  createIntegrationApp,
  cleanupTestUser,
  useIsolatedSchema,
} from "./helpers";

type Wallet = { metal: number; crystal: number; deuterium: number };
const resources = ["metal", "crystal", "deuterium"] as const;
type Levels = {
  metalMine: number;
  crystalMine: number;
  deuteriumMine: number;
  solarPlant: number;
};

/** Intégration indépendante par morceaux : un niveau ne produit qu'après sa finalisation. */
function hourly(levels: Levels): Wallet {
  const output = (base: number, level: number) => base * level * 1.1 ** level;
  const used = Math.floor(
    output(10, levels.metalMine) +
      output(10, levels.crystalMine) +
      output(20, levels.deuteriumMine),
  );
  const available = Math.floor(output(20, levels.solarPlant));
  const efficiency =
    available <= 0
      ? 0
      : used <= available
        ? 1
        : Math.floor((available / used) * 100) / 100;
  return {
    metal: 20 + output(30, levels.metalMine) * efficiency,
    crystal: 10 + output(20, levels.crystalMine) * efficiency,
    deuterium: output(10, levels.deuteriumMine) * efficiency,
  };
}

describe("Première heure à vitesse ×1, API réelle, horloge simulée et PostgreSQL", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let config: ServerConfigService;
  let previous: ServerConfigValues;
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;
  const reports: Array<Record<string, unknown>> = [];
  const users: string[] = [];
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    isolated = await useIsolatedSchema("first_hour");
    ({ app, database } = await createIntegrationApp());
    config = app.get(ServerConfigService);
    previous = await config.getConfig();
    await config.applyConfig({
      gameSpeed: 1,
      fleetSpeed: 1,
      resourceMultiplier: 1,
      buildingCostMultiplier: 1,
      researchCostMultiplier: 1,
      shipCostMultiplier: 1,
      baseMetal: 20,
      baseCrystal: 10,
      baseDeuterium: 0,
    });
  });
  afterAll(async () => {
    jest.useRealTimers();
    if (process.env.XNOVA_FIRST_HOUR_REPORT) {
      writeFileSync(
        process.env.XNOVA_FIRST_HOUR_REPORT,
        JSON.stringify(
          {
            simulatedSeconds: 3600,
            tickSeconds: 10,
            settings: {
              gameSpeed: 1,
              resourceMultiplier: 1,
              costMultipliers: 1,
            },
            scenarios: reports,
          },
          null,
          2,
        ),
      );
    }
    for (const username of users) await cleanupTestUser(database, username);
    if (previous) await config.applyConfig(previous);
    await app?.close();
    await isolated?.drop();
  });

  const cases = [
    { name: "sans action", polling: 10, plan: [] },
    {
      name: "mines et énergie, lecture toutes les 10 secondes",
      polling: 10,
      plan: [4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 14, 31],
    },
    {
      name: "mines et énergie, lecture à chaque minute",
      polling: 60,
      plan: [4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 14, 31],
    },
    {
      name: "objectif laboratoire après mise en place des mines",
      polling: 10,
      plan: [4, 1, 2, 3, 4, 31],
    },
    { name: "métal seul sans énergie", polling: 10, plan: [1, 1, 1] },
    {
      name: "priorité métal, deutérium différé",
      polling: 10,
      plan: [4, 1, 1, 1, 2, 4, 2, 4, 3, 31],
    },
    {
      name: "priorité deutérium et énergie",
      polling: 10,
      plan: [4, 3, 4, 1, 2, 3, 31],
    },
  ];

  for (const scenario of cases) {
    it(
      scenario.name,
      async () => {
        const credentials = buildTestUser();
        users.push(credentials.username);
        const registered = await request(server())
          .post("/auth/register")
          .send(credentials)
          .expect(201);
        let token = registered.body.tokens.accessToken;
        let refreshToken = registered.body.tokens.refreshToken;
        const player = await database.user.findUniqueOrThrow({
          where: { username: credentials.username },
          include: { planets: true },
        });
        const planetId = player.planets[0].id;
        const base = Math.floor(Date.now() / 1000) * 1000;
        // Seul lastUpdate est aligné sur l'horloge ; stocks et niveaux proviennent de l'inscription.
        await database.planet.update({
          where: { id: planetId },
          data: { lastUpdate: new Date(base) },
        });
        const initial: Wallet = {
          metal: player.planets[0].metal,
          crystal: player.planets[0].crystal,
          deuterium: player.planets[0].deuterium,
        };
        expect(initial).toEqual({ metal: 500, crystal: 500, deuterium: 0 });
        const expected = { ...initial };
        const produced = { metal: 0, crystal: 0, deuterium: 0 };
        const spent = { metal: 0, crystal: 0, deuterium: 0 };
        let levels: Levels = player.planets[0];
        let last = 0;
        let step = 0;
        let currentQueue: string | null = null;
        const actions: Array<Record<string, unknown>> = [];
        const checkpoints: Array<Record<string, unknown>> = [];
        const auth = () => ({ Authorization: `Bearer ${token}` });
        jest.useFakeTimers({
          doNotFake: [
            "hrtime",
            "nextTick",
            "performance",
            "queueMicrotask",
            "setImmediate",
            "clearImmediate",
            "setTimeout",
            "clearTimeout",
            "setInterval",
            "clearInterval",
          ],
        });
        try {
          for (let second = 0; second <= 3600; second += 10) {
            const rates = hourly(levels);
            for (const resource of resources) {
              const income = (rates[resource] * (second - last)) / 3600;
              expected[resource] += income;
              produced[resource] += income;
            }
            last = second;
            jest.setSystemTime(base + second * 1000);
            await app.get(BuildingsCronService).handleCompletedBuildings();
            await app.get(ResearchCronService).handleCompletedResearch();
            levels = await database.planet.findUniqueOrThrow({
              where: { id: planetId },
            });
            if (second % 60 === 0)
              await app.get(ResourcesCronService).updateAllPlanetsResources();
            if (second === 3300) {
              const refreshed = await request(server())
                .post("/auth/refresh")
                .send({ refreshToken })
                .expect(200);
              token = refreshed.body.accessToken;
              refreshToken = refreshed.body.refreshToken;
            }
            if (currentQueue) {
              const row = await database.buildQueue.findUniqueOrThrow({
                where: { id: currentQueue },
              });
              if (row.completed) {
                actions.push({
                  second,
                  event: "terminé",
                  building: BUILDINGS[row.buildingId].name,
                  level: row.level,
                });
                currentQueue = null;
              }
            }
            if (second % scenario.polling === 0)
              await request(server())
                .get(`/planets/${planetId}/resources`)
                .set(auth())
                .expect(200);
            if (!currentQueue && step < scenario.plan.length && second < 3600) {
              // Lire les mêmes coûts, prérequis et durées qu'un joueur dans la vue Bâtiments.
              const list = await request(server())
                .get(`/planets/${planetId}/buildings`)
                .set(auth())
                .expect(200);
              const building = list.body.buildings.find(
                (row: { id: number }) => row.id === scenario.plan[step],
              );
              const wallet = await database.planet.findUniqueOrThrow({
                where: { id: planetId },
              });
              if (
                resources.every(
                  (resource) => wallet[resource] >= building.cost[resource],
                ) &&
                building.canBuild
              ) {
                const started = await request(server())
                  .post(`/planets/${planetId}/build`)
                  .set(auth())
                  .send({ buildingId: building.id })
                  .expect(201);
                const duration =
                  (new Date(started.body.endTime).getTime() -
                    new Date(started.body.startTime).getTime()) /
                  1000;
                expect(duration).toBe(building.buildTime);
                const row = await database.buildQueue.findFirstOrThrow({
                  where: {
                    planetId,
                    buildingId: building.id,
                    completed: false,
                  },
                });
                currentQueue = row.id;
                for (const resource of resources) {
                  expected[resource] -= building.cost[resource];
                  spent[resource] += building.cost[resource];
                }
                actions.push({
                  second,
                  event: "lancé",
                  building: building.name,
                  level: building.currentLevel + 1,
                  duration,
                  cost: building.cost,
                });
                step++;
              }
            }
            if (second % 900 === 0) {
              const snapshot = await request(server())
                .get(`/planets/${planetId}/resources`)
                .set(auth())
                .expect(200);
              checkpoints.push({
                second,
                resources: snapshot.body.resources,
                productionPerHour: snapshot.body.production,
                energy: snapshot.body.energy,
              });
            }
          }
          const final = await database.planet.findUniqueOrThrow({
            where: { id: planetId },
          });
          const actual = {
            metal: final.metal,
            crystal: final.crystal,
            deuterium: final.deuterium,
          };
          const error = Object.fromEntries(
            resources.map((resource) => [
              resource,
              actual[resource] - expected[resource],
            ]),
          );
          const buildingList = await request(server())
            .get(`/planets/${planetId}/buildings`)
            .set(auth())
            .expect(200);
          const next =
            step < scenario.plan.length
              ? buildingList.body.buildings.find(
                  (row: { id: number }) => row.id === scenario.plan[step],
                )
              : null;
          const technologies = await request(server())
            .get(`/technologies?planetId=${planetId}`)
            .set(auth())
            .expect(200);
          const researchRefused = await request(server())
            .post("/research")
            .set(auth())
            .send({ planetId, techId: 113 })
            .expect(400);
          if (next) {
            await request(server())
              .post(`/planets/${planetId}/build`)
              .set(auth())
              .send({ buildingId: next.id })
              .expect(400);
          }
          const afterRefusal = await database.planet.findUniqueOrThrow({
            where: { id: planetId },
          });
          for (const resource of resources)
            expect(afterRefusal[resource]).toBe(actual[resource]);
          expect(
            await database.researchQueue.count({
              where: { userId: player.id },
            }),
          ).toBe(0);
          expect(final.fieldsUsed).toBe(
            actions.filter((action) => action.event === "terminé").length,
          );
          reports.push({
            name: scenario.name,
            pollingSeconds: scenario.polling,
            initial,
            produced,
            spent,
            actual,
            expected,
            error,
            levels: {
              metalMine: final.metalMine,
              crystalMine: final.crystalMine,
              deuteriumMine: final.deuteriumMine,
              solarPlant: final.solarPlant,
              roboticsFactory: final.roboticsFactory,
              researchLab: final.researchLab,
            },
            actions,
            checkpoints,
            researchRefusal: researchRefused.body.message,
            next: next
              ? {
                  name: next.name,
                  cost: next.cost,
                  missing: Object.fromEntries(
                    resources.map((resource) => [
                      resource,
                      Math.max(0, next.cost[resource] - actual[resource]),
                    ]),
                  ),
                }
              : null,
            technologies: technologies.body.technologies.map(
              (tech: {
                id: number;
                name: string;
                canResearch: boolean;
                cost: Wallet;
              }) => ({
                id: tech.id,
                name: tech.name,
                canResearch: tech.canResearch,
                cost: tech.cost,
              }),
            ),
          });
          for (const resource of resources) {
            expect(actual[resource]).toBeGreaterThanOrEqual(0);
            expect(actual[resource] - expected[resource]).toBeCloseTo(0, 6);
          }
        } finally {
          jest.useRealTimers();
          await cleanupTestUser(database, credentials.username);
        }
      },
      180000,
    );
  }
});
