import { INestApplication } from "@nestjs/common";
import { writeFileSync } from "fs";
import request from "supertest";
import { ABANDONED_USERNAME } from "@xnova/game-config";
import { DatabaseService } from "../../src/database/database.service";
import { BuildingsCronService } from "../../src/buildings/buildings-cron.service";
import { ResearchCronService } from "../../src/research/research-cron.service";
import { ResourcesCronService } from "../../src/resources/resources-cron.service";
import { ShipyardCronService } from "../../src/shipyard/shipyard-cron.service";
import { FleetCronService } from "../../src/fleet/fleet-cron.service";
import {
  ServerConfigService,
  ServerConfigValues,
} from "../../src/server-config/server-config.service";
import {
  buildTestUser,
  createIntegrationApp,
  cleanupTestUser,
  useIsolatedSchema,
} from "./helpers";

/**
 * Premier cycle joueur complet (inscription → rapport de mission), API réelle, PostgreSQL réel
 * et horloge simulée, SANS ajout manuel de ressources.
 *
 * Profil de référence : vitesse du jeu ×50 (voir docs/PROGRESSION.md, « Rythme du premier cycle »).
 * Les formules et coûts ne changent pas ; la vitesse est un réglage serveur existant.
 * Le plan d'achat est celui d'un joueur raisonnable, calculé hors ligne avec les formules du moteur
 * (minutes simulées ≈ labo 22, recherche 66, hangar 71, premier chasseur 138).
 */
const SPEED = 50;
const TICK_SECONDS = 5;
const HORIZON_SECONDS = 3 * 3600 + 20 * 60;

// Ordre des achats par file ; chaque élément est lancé dès qu'il est accessible et abordable.
// Dernière centrale solaire : rééquilibre l'énergie après les mines (objectif « équilibrer l'énergie »)
const BUILDING_PLAN = [4, 3, 31, 2, 4, 3, 4, 21, 1, 1, 4];
const RESEARCH_PLAN = [113, 115];
const SHIP_ID = 204; // chasseur léger : Hangar 1 + Réacteur à combustion 1

// Seuils de référence à ×50, en minutes simulées (marge sur la simulation hors ligne)
const TARGET_MINUTES = {
  lab: 60,
  researchStarted: 90,
  shipyard: 120,
  firstShip: 180,
  missionSent: 180,
  missionReport: 200,
  planCompleted: 200,
};

const resources = ["metal", "crystal", "deuterium"] as const;

describe("Premier cycle joueur à vitesse ×50, sans ajout de ressources", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let config: ServerConfigService;
  let previous: ServerConfigValues;
  let isolated: Awaited<ReturnType<typeof useIsolatedSchema>>;
  let username: string | null = null;
  const report: Record<string, unknown> = {};
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    isolated = await useIsolatedSchema("first_cycle");
    ({ app, database } = await createIntegrationApp());
    config = app.get(ServerConfigService);
    previous = await config.getConfig();
    await config.applyConfig({
      gameSpeed: SPEED,
      fleetSpeed: SPEED,
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
    if (process.env.XNOVA_FIRST_CYCLE_REPORT) {
      writeFileSync(process.env.XNOVA_FIRST_CYCLE_REPORT, JSON.stringify(report, null, 2));
    }
    if (username) await cleanupTestUser(database, username);
    if (previous) await config.applyConfig(previous);
    await app?.close();
    await isolated?.drop();
  });

  it(
    "atteint laboratoire, recherche, chantier, vaisseau, mission et rapport dans les délais cibles",
    async () => {
      const credentials = buildTestUser();
      username = credentials.username;
      const registered = await request(server()).post("/auth/register").send(credentials).expect(201);
      let token: string = registered.body.tokens.accessToken;
      let refreshToken: string = registered.body.tokens.refreshToken;
      const auth = () => ({ Authorization: `Bearer ${token}` });

      const player = await database.user.findUniqueOrThrow({
        where: { username: credentials.username },
        include: { planets: true },
      });
      const planetId = player.planets[0].id;
      const base = Math.floor(Date.now() / 1000) * 1000;
      await database.planet.update({ where: { id: planetId }, data: { lastUpdate: new Date(base) } });
      expect({
        metal: player.planets[0].metal,
        crystal: player.planets[0].crystal,
        deuterium: player.planets[0].deuterium,
      }).toEqual({ metal: 500, crystal: 500, deuterium: 0 });

      const milestones: Record<string, number> = {};
      const mark = (name: string, second: number) => {
        if (!(name in milestones)) milestones[name] = second;
      };
      const events: Array<Record<string, unknown>> = [];
      let buildStep = 0;
      let researchStep = 0;
      let shipOrdered = false;
      let missionSent = false;
      let minStock = Infinity;
      let spyTarget: { galaxy: number; system: number; position: number } | null = null;

      jest.useFakeTimers({
        doNotFake: [
          "hrtime", "nextTick", "performance", "queueMicrotask", "setImmediate",
          "clearImmediate", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
        ],
      });
      try {
        for (let second = 0; second <= HORIZON_SECONDS; second += TICK_SECONDS) {
          jest.setSystemTime(base + second * 1000);
          await app.get(BuildingsCronService).handleCompletedBuildings();
          await app.get(ResearchCronService).handleCompletedResearch();
          await app.get(ShipyardCronService).handleCompletedBuilds();
          await app.get(FleetCronService).handleFleetStatus();
          if (second % 60 === 0) await app.get(ResourcesCronService).updateAllPlanetsResources();
          if (second > 0 && second % 3300 === 0) {
            const refreshed = await request(server()).post("/auth/refresh").send({ refreshToken }).expect(200);
            token = refreshed.body.accessToken;
            refreshToken = refreshed.body.refreshToken;
          }

          const planet = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
          minStock = Math.min(minStock, planet.metal, planet.crystal, planet.deuterium);
          if (planet.researchLab >= 1) mark("lab", second);
          if (planet.shipyard >= 1) mark("shipyard", second);

          // File bâtiments
          if (buildStep < BUILDING_PLAN.length) {
            const active = await database.buildQueue.count({ where: { planetId, completed: false } });
            if (active === 0) {
              const id = BUILDING_PLAN[buildStep];
              const list = await request(server()).get(`/planets/${planetId}/buildings`).set(auth()).expect(200);
              const building = list.body.buildings.find((row: { id: number }) => row.id === id);
              if (building.canBuild && resources.every((r) => planet[r] >= building.cost[r])) {
                await request(server()).post(`/planets/${planetId}/build`).set(auth()).send({ buildingId: id }).expect(201);
                events.push({ second, event: "bâtiment", id, level: building.currentLevel + 1 });
                buildStep++;
              }
            }
          }

          // File recherche
          if (researchStep < RESEARCH_PLAN.length && planet.researchLab >= 1) {
            const active = await database.researchQueue.count({ where: { userId: player.id, completed: false } });
            if (active === 0) {
              const id = RESEARCH_PLAN[researchStep];
              const techs = await request(server()).get(`/technologies?planetId=${planetId}`).set(auth()).expect(200);
              const tech = techs.body.technologies.find((row: { id: number }) => row.id === id);
              if (tech.canResearch && resources.every((r) => planet[r] >= tech.cost[r])) {
                await request(server()).post("/research").set(auth()).send({ planetId, techId: id }).expect(201);
                mark("researchStarted", second);
                events.push({ second, event: "recherche", id });
                researchStep++;
              }
            }
          }

          // Chantier spatial : un chasseur dès que Hangar 1 + Combustion 1
          if (!shipOrdered && planet.shipyard >= 1) {
            const shipyard = await request(server()).get(`/shipyard?planetId=${planetId}`).set(auth()).expect(200);
            const ship = shipyard.body.ships.find((row: { id: number }) => row.id === SHIP_ID);
            if (ship?.canBuild && resources.every((r) => planet[r] >= ship.cost[r])) {
              await request(server()).post("/shipyard/build").set(auth()).send({ planetId, shipId: SHIP_ID, amount: 1 }).expect(201);
              shipOrdered = true;
              events.push({ second, event: "vaisseau commandé" });
            }
          }
          if (shipOrdered) {
            const owned = await database.ship.findFirst({ where: { planetId, shipId: SHIP_ID, amount: { gte: 1 } } });
            if (owned) mark("firstShip", second);
          }

          // Première mission : attaque d'une planète abandonnée voisine
          if (milestones.firstShip !== undefined && !missionSent) {
            if (!spyTarget) {
              const abandoned = await database.planet.findFirst({
                where: { user: { username: ABANDONED_USERNAME }, galaxy: planet.galaxy, system: planet.system },
                orderBy: { position: "asc" },
              });
              const fallback = await database.planet.findFirstOrThrow({
                where: { user: { username: ABANDONED_USERNAME } },
                orderBy: [{ galaxy: "asc" }, { system: "asc" }, { position: "asc" }],
              });
              const target = abandoned ?? fallback;
              spyTarget = { galaxy: target.galaxy, system: target.system, position: target.position };
            }
            const sent = await request(server())
              .post("/fleet/send")
              .set(auth())
              .send({
                planetId,
                toGalaxy: spyTarget.galaxy,
                toSystem: spyTarget.system,
                toPosition: spyTarget.position,
                mission: 1,
                speedPercent: 100,
                ships: { [SHIP_ID]: 1 },
              });
            if (sent.status === 201) {
              missionSent = true;
              mark("missionSent", second);
              events.push({ second, event: "flotte envoyée", target: spyTarget });
            } else {
              // Pas assez de carburant tant que le deutérium n'est pas suffisant : on réessaie
              expect([400]).toContain(sent.status);
            }
          }
          if (missionSent) {
            const reports = await database.combatReport.count({ where: { attackerId: player.id } });
            if (reports > 0) {
              mark("missionReport", second);
            }
            // On poursuit jusqu'à la fin du plan de construction pour juger l'état final des objectifs
            const queued = await database.buildQueue.count({ where: { planetId, completed: false } });
            if (milestones.missionReport !== undefined && buildStep >= BUILDING_PLAN.length && queued === 0) {
              mark("planCompleted", second);
              break;
            }
          }
        }

        // Jalons et seuils
        const minutes = Object.fromEntries(
          Object.entries(milestones).map(([k, v]) => [k, Math.round((v / 60) * 10) / 10]),
        );
        report.profile = { gameSpeed: SPEED, fleetSpeed: SPEED, tickSeconds: TICK_SECONDS };
        report.milestonesMinutes = minutes;
        report.targetsMinutes = TARGET_MINUTES;
        report.events = events;
        report.minimumStock = minStock;

        expect(minStock).toBeGreaterThanOrEqual(0);
        for (const [name, limit] of Object.entries(TARGET_MINUTES)) {
          const reached = minutes[name];
          expect(reached).toBeDefined();
          expect(reached).toBeLessThanOrEqual(limit);
        }

        // Le guide d'objectifs reflète le parcours : tout est terminé
        const onboarding = await request(server()).get("/progression/onboarding").set(auth()).expect(200);
        report.onboarding = {
          completed: onboarding.body.completed,
          total: onboarding.body.total,
          pending: onboarding.body.steps
            .filter((step: { status: string }) => step.status !== "done")
            .map((step: { id: string }) => step.id),
        };
        expect(onboarding.body.finished).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    },
    900000,
  );
});
