import { INestApplication } from '@nestjs/common';
import { calculateEnergyBalance } from '@xnova/game-engine';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import {
  buildTestUser,
  cleanupTestUser,
  createIntegrationApp,
  registerAndLogin,
} from './helpers';

/**
 * GAME-04 — le seuil d'énergie de la technologie Graviton est vérifié avant tout lancement.
 * Règle : l'énergie PRODUITE par la planète (bâtiments) doit atteindre le seuil ; elle n'est pas consommée.
 */
describe('API integration - Recherche et énergie (GAME-04)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let username: string;
  let token: string;
  let userId: string;
  let planetId: string;

  const GRAVITON = 199;
  const THRESHOLD = 300000;

  const levels = (solarPlant: number) => ({
    metalMine: 0,
    crystalMine: 0,
    deuteriumMine: 0,
    solarPlant,
    fusionPlant: 0,
    metalStorage: 0,
    crystalStorage: 0,
    deuteriumStorage: 0,
  });

  // Plus petit niveau de centrale solaire qui atteint le seuil (calculé avec le moteur réel)
  const minSolarLevel = () => {
    for (let level = 1; level < 200; level++) {
      if (calculateEnergyBalance(levels(level)).available >= THRESHOLD) return level;
    }
    throw new Error('seuil inatteignable');
  };

  const start = (techId = GRAVITON) =>
    request(app.getHttpServer())
      .post('/research')
      .set('Authorization', `Bearer ${token}`)
      .send({ planetId, techId });

  const listing = async () => {
    const res = await request(app.getHttpServer())
      .get('/technologies')
      .query({ planetId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.technologies.find((t: any) => t.id === GRAVITON);
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    const user = buildTestUser();
    username = user.username;
    token = (await registerAndLogin(app, user)).accessToken;
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    userId = me.body.id;
    planetId = me.body.planets[0].id;
  });

  beforeEach(async () => {
    await database.researchQueue.deleteMany({ where: { userId } });
    await database.technology.deleteMany({ where: { userId } });
    await database.planet.update({
      where: { id: planetId },
      data: {
        researchLab: 12, // prérequis du Graviton
        solarPlant: 0,
        fusionPlant: 0,
        metal: 1000,
        crystal: 1000,
        deuterium: 1000,
        lastUpdate: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  it('refuse le lancement sans énergie suffisante, sans débit ni file', async () => {
    const before = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    const res = await start();

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/Energie insuffisante/);
    expect(await database.researchQueue.count({ where: { userId } })).toBe(0);
    const after = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    expect([after.metal, after.crystal, after.deuterium]).toEqual([
      before.metal,
      before.crystal,
      before.deuterium,
    ]);
  });

  it('la liste signale le manque d\'énergie et bloque canResearch', async () => {
    const tech = await listing();
    expect(tech.energyRequired).toBe(THRESHOLD);
    expect(tech.energyAvailable).toBe(0);
    expect(tech.hasEnoughEnergy).toBe(false);
    expect(tech.canResearch).toBe(false);
    expect(tech.missingRequirements.join(' ')).toMatch(/Energie/);
  });

  it('frontière : refus à N-1, acceptation à N, l\'énergie n\'est pas consommée', async () => {
    const minLevel = minSolarLevel();

    await database.planet.update({ where: { id: planetId }, data: { solarPlant: minLevel - 1 } });
    await start().expect(400);

    await database.planet.update({ where: { id: planetId }, data: { solarPlant: minLevel } });
    const tech = await listing();
    expect(tech.hasEnoughEnergy).toBe(true);
    expect(tech.canResearch).toBe(true);

    await start().expect(201);
    expect(await database.researchQueue.count({ where: { userId, completed: false } })).toBe(1);

    // Rien n'est consommé : coût nul, bâtiments inchangés
    const after = await database.planet.findUniqueOrThrow({ where: { id: planetId } });
    expect(after.solarPlant).toBe(minLevel);
    expect(after.metal).toBe(1000);
  });

  it('les technologies sans seuil d\'énergie ne sont pas affectées', async () => {
    const res = await request(app.getHttpServer())
      .get('/technologies')
      .query({ planetId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const espionage = res.body.technologies.find((t: any) => t.id === 106);
    expect(espionage.hasEnoughEnergy).toBe(true);
    expect(espionage.energyRequired).toBe(0);
  });
});
