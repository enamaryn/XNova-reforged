import { INestApplication } from '@nestjs/common';
import { BuildingsService } from '../../src/buildings/buildings.service';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { ResearchService } from '../../src/research/research.service';
import { ShipyardService } from '../../src/shipyard/shipyard.service';
import { DORMANT_SINCE, createIntegrationApp, deleteUsersByIds } from './helpers';

/**
 * ECO-04 — chaque événement (arrivée, retour, combat, finalisation) n'a d'effet qu'une fois,
 * même traité par deux workers en parallèle.
 */
describe('API integration - Exécution unique des événements (ECO-04)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;
  let buildings: BuildingsService;
  let research: ResearchService;
  let shipyard: ShipyardService;

  const suffix = Math.random().toString(36).slice(2, 8);
  let userA: string;
  let userB: string;
  let origin: { id: string; galaxy: number; system: number; position: number };
  let target: { id: string; galaxy: number; system: number; position: number };

  const past = (seconds: number) => new Date(Date.now() - seconds * 1000);

  const makeFleet = (data: Record<string, unknown>) =>
    database.fleet.create({
      data: {
        userId: userA,
        fromGalaxy: origin.galaxy,
        fromSystem: origin.system,
        fromPosition: origin.position,
        toGalaxy: target.galaxy,
        toSystem: target.system,
        toPosition: target.position,
        mission: 3,
        ships: { '202': 2 },
        cargo: { metal: 1000, crystal: 0, deuterium: 0 },
        startTime: past(120),
        arrivalTime: past(60),
        returnTime: past(10),
        status: 'traveling',
        ...data,
      } as any,
    });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);
    buildings = app.get(BuildingsService);
    research = app.get(ResearchService);
    shipyard = app.get(ShipyardService);

    const mkUser = (tag: string) =>
      database.user.create({
        data: {
          username: `e4${tag}_${suffix}`,
          email: `e4${tag}_${suffix}@example.test`,
          password: 'x',
          lastActive: DORMANT_SINCE(), // hors production périodique : stocks stables
        },
      });
    userA = (await mkUser('a')).id;
    userB = (await mkUser('b')).id;
    // Coordonnées tirées au hasard : on retente si l'emplacement est déjà pris (semis de galaxie, autres suites)
    const mkPlanet = async (userId: string, firstPosition: number, span: number) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await database.planet.create({
            data: {
              userId,
              name: 'E4',
              galaxy: 9,
              system: 490 + Math.floor(Math.random() * 9),
              position: firstPosition + Math.floor(Math.random() * span),
            },
          });
        } catch (error: any) {
          if (error?.code !== 'P2002' || attempt >= 50) throw error;
        }
      }
    };
    origin = await mkPlanet(userA, 1, 7);
    target = await mkPlanet(userB, 8, 7);
  });

  beforeEach(async () => {
    await database.fleet.deleteMany({ where: { userId: userA } });
    await database.combatReport.deleteMany({ where: { attackerId: userA } });
    await database.ship.deleteMany({ where: { planetId: { in: [origin.id, target.id] } } });
    await database.planet.update({
      where: { id: origin.id },
      data: { metal: 0, crystal: 0, deuterium: 0 },
    });
    await database.planet.update({
      where: { id: target.id },
      data: { metal: 10000, crystal: 10000, deuterium: 10000 },
    });
  });

  afterAll(async () => {
    await deleteUsersByIds(database, [userA, userB]);
    if (app) await app.close();
  });

  it('arrivée : deux workers ne livrent le cargo qu\'une fois', async () => {
    const fleet = await makeFleet({});

    await Promise.all([fleetCron.processArrivals(), fleetCron.processArrivals()]);

    const after = await database.planet.findUniqueOrThrow({ where: { id: target.id } });
    const updated = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    expect(after.metal).toBe(11000);
    expect(updated.status).toBe('returning');
    expect(updated.cargo).toEqual({});
  });

  it('retour : deux workers ne créditent vaisseaux et cargo qu\'une fois', async () => {
    await makeFleet({
      status: 'returning',
      cargo: { metal: 500, crystal: 0, deuterium: 0 },
    });

    await Promise.all([fleetCron.processReturns(), fleetCron.processReturns()]);

    const planet = await database.planet.findUniqueOrThrow({ where: { id: origin.id } });
    const ship = await database.ship.findUnique({
      where: { planetId_shipId: { planetId: origin.id, shipId: 202 } },
    });
    expect(planet.metal).toBe(500);
    expect(ship?.amount).toBe(2);
  });

  it('attaque : un seul rapport et un seul butin malgré deux workers', async () => {
    await database.ship.create({ data: { planetId: origin.id, shipId: 202, amount: 0 } });
    await makeFleet({
      mission: 1,
      ships: { '206': 50 },
      cargo: {},
    });

    await Promise.all([fleetCron.processArrivals(), fleetCron.processArrivals()]);

    const reports = await database.combatReport.count({ where: { attackerId: userA } });
    const after = await database.planet.findUniqueOrThrow({ where: { id: target.id } });
    expect(reports).toBe(1);
    // Le butin éventuel ne peut être prélevé qu'une fois (au plus 50 % du stock) et jamais négatif
    expect(after.metal).toBeGreaterThanOrEqual(5000);
    expect(after.metal).toBeLessThanOrEqual(10000);
  });

  it('bâtiment : finalisation en double, un seul niveau et un seul champ', async () => {
    await database.planet.update({
      where: { id: origin.id },
      data: { metalMine: 0, fieldsUsed: 0 },
    });
    const entry = await database.buildQueue.create({
      data: {
        planetId: origin.id,
        buildingId: 1,
        level: 1,
        startTime: past(60),
        endTime: past(1),
      },
    });

    await Promise.all([
      buildings.completeConstruction(entry),
      buildings.completeConstruction(entry),
      buildings.completeConstruction(entry),
    ]);

    const after = await database.planet.findUniqueOrThrow({ where: { id: origin.id } });
    expect(after.metalMine).toBe(1);
    expect(after.fieldsUsed).toBe(1);
  });

  it('chantier : finalisation en double, un seul lot de vaisseaux', async () => {
    const entry = await database.shipQueue.create({
      data: {
        planetId: origin.id,
        shipId: 202,
        amount: 3,
        startTime: past(60),
        endTime: past(1),
      },
    });

    await Promise.all([shipyard.completeBuild(entry), shipyard.completeBuild(entry)]);

    const ship = await database.ship.findUnique({
      where: { planetId_shipId: { planetId: origin.id, shipId: 202 } },
    });
    expect(ship?.amount).toBe(3);
  });

  it('recherche : finalisation en double, un seul niveau', async () => {
    const entry = await database.researchQueue.create({
      data: {
        userId: userA,
        planetId: origin.id,
        techId: 113,
        level: 1,
        startTime: past(60),
        endTime: past(1),
      },
    });

    await Promise.all([research.completeResearch(entry), research.completeResearch(entry)]);

    const techs = await database.technology.findMany({ where: { userId: userA, techId: 113 } });
    expect(techs).toHaveLength(1);
    expect(techs[0].level).toBe(1);
    await database.technology.deleteMany({ where: { userId: userA } });
  });
});
