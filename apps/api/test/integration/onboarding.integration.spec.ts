import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

describe('API integration - Objectifs débutants', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const users: string[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const username of users) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  const fetchProgress = async (token: string) => {
    const response = await request(app.getHttpServer())
      .get('/progression/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body as {
      completed: number;
      total: number;
      currentStepId: string | null;
      finished: boolean;
      steps: Array<{ id: string; status: string; route: string }>;
    };
  };

  it('refuse l\'accès sans jeton', async () => {
    await request(app.getHttpServer()).get('/progression/onboarding').expect(401);
  });

  it('un compte neuf commence par la centrale solaire', async () => {
    const user = buildTestUser();
    users.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);

    const progress = await fetchProgress(accessToken);
    expect(progress.completed).toBe(0);
    expect(progress.currentStepId).toBe('solar_plant');
    expect(progress.steps[0]).toMatchObject({ id: 'solar_plant', status: 'current', route: 'buildings' });
  });

  it('suit l\'état réel : bâtiments, énergie, vaisseaux et missions', async () => {
    const user = buildTestUser();
    users.push(user.username);
    const { accessToken } = await registerAndLogin(app, user);
    const owner = await database.user.findUniqueOrThrow({ where: { username: user.username } });
    const planet = await database.planet.findFirstOrThrow({ where: { userId: owner.id } });

    // Énergie + trois mines construites, énergie suffisante
    await database.planet.update({
      where: { id: planet.id },
      data: {
        solarPlant: 2,
        metalMine: 1,
        crystalMine: 1,
        deuteriumMine: 1,
        energyUsed: 30,
        energyAvailable: 48,
      },
    });
    let progress = await fetchProgress(accessToken);
    expect(progress.steps.filter((s) => s.status === 'done').map((s) => s.id)).toEqual([
      'solar_plant',
      'metal_mine',
      'crystal_mine',
      'deuterium_mine',
      'energy_balance',
    ]);
    expect(progress.currentStepId).toBe('research_lab');

    // Laboratoire, recherche, chantier, vaisseau
    await database.planet.update({ where: { id: planet.id }, data: { researchLab: 1, shipyard: 1 } });
    await database.technology.create({ data: { userId: owner.id, techId: 113, level: 1 } });
    await database.ship.create({ data: { planetId: planet.id, shipId: 204, amount: 1 } });
    progress = await fetchProgress(accessToken);
    expect(progress.currentStepId).toBe('first_mission');

    // Une flotte en vol : mission envoyée, pas encore de résultat
    const fleet = await database.fleet.create({
      data: {
        userId: owner.id,
        fromGalaxy: planet.galaxy,
        fromSystem: planet.system,
        fromPosition: planet.position,
        toGalaxy: planet.galaxy,
        toSystem: planet.system,
        toPosition: planet.position === 1 ? 2 : 1,
        mission: 3,
        ships: { '204': 1 },
        cargo: {},
        startTime: new Date(),
        arrivalTime: new Date(Date.now() + 60_000),
        status: 'traveling',
      },
    });
    progress = await fetchProgress(accessToken);
    expect(progress.currentStepId).toBe('mission_report');

    // La flotte rentre : la mission a abouti
    await database.fleet.update({ where: { id: fleet.id }, data: { status: 'returning' } });
    progress = await fetchProgress(accessToken);
    expect(progress.finished).toBe(true);
    expect(progress.completed).toBe(progress.total);
  });

  it('ne montre pas la progression d\'un autre joueur', async () => {
    const a = buildTestUser();
    const b = buildTestUser();
    users.push(a.username, b.username);
    const { accessToken: tokenA } = await registerAndLogin(app, a);
    const { accessToken: tokenB } = await registerAndLogin(app, b);
    const ownerA = await database.user.findUniqueOrThrow({ where: { username: a.username } });
    await database.planet.updateMany({ where: { userId: ownerA.id }, data: { solarPlant: 3 } });

    expect((await fetchProgress(tokenA)).steps[0].status).toBe('done');
    expect((await fetchProgress(tokenB)).steps[0].status).toBe('current');
  });
});
