import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getWorldEventTemplate, templateOccurrence } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { EventModifiersService } from '../../src/world-events/event-modifiers.service';
import { WorldEventsService } from '../../src/world-events/world-events.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Événements du monde : lancement et arrêt par un administrateur, règlement de la production avant chaque
 * changement (le bonus ne s'applique jamais au temps déjà écoulé), case « automatique », rappels, rôles, taxe du
 * marché réduite.
 */
describe('API integration - événements du monde', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let events: WorldEventsService;
  let modifiers: EventModifiersService;
  const users: ReturnType<typeof buildTestUser>[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    events = app.get(WorldEventsService);
    modifiers = app.get(EventModifiersService);
  });

  afterEach(async () => {
    await database.worldEvent.deleteMany();
    await database.worldEventSetting.deleteMany();
    modifiers.invalidate();
  });

  afterAll(async () => {
    for (const user of users) await cleanupTestUser(database, user.username);
    await database.worldEvent.deleteMany();
    if (app) await app.close();
  });

  const account = async (role: 'PLAYER' | 'MODERATOR' | 'ADMIN' = 'PLAYER') => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    if (role !== 'PLAYER') await database.user.update({ where: { id: me.body.id }, data: { role } });
    return { token: accessToken as string, userId: me.body.id as string, planetId: me.body.planets[0].id as string };
  };
  type Account = Awaited<ReturnType<typeof account>>;
  const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
  const hourly = async (a: Account) =>
    (await request(app.getHttpServer()).get(`/planets/${a.planetId}/resources`).set(auth(a)).expect(200)).body.production.metal as number;

  it('refuse aux joueurs et aux modérateurs la console des événements, mais montre les événements actifs à tous', async () => {
    const player = await account();
    const moderator = await account('MODERATOR');
    for (const who of [player, moderator]) {
      await request(app.getHttpServer()).get('/admin/world-events').set(auth(who)).expect(403);
      await request(app.getHttpServer())
        .post('/admin/world-events/launch-custom')
        .set(auth(who))
        .send({ name: 'Intrus', days: 1, productionBonus: 0.5 })
        .expect(403);
    }
    expect(await database.worldEvent.count()).toBe(0);
    const active = await request(app.getHttpServer()).get('/world-events/active').set(auth(player)).expect(200);
    expect(active.body.events).toEqual([]);
  });

  it('lance un événement personnalisé : production ×1,5 pendant, normale après, journal d’audit écrit', async () => {
    const admin = await account('ADMIN');
    const before = await hourly(admin);
    expect(before).toBeGreaterThan(0);

    const launched = await request(app.getHttpServer())
      .post('/admin/world-events/launch-custom')
      .set(auth(admin))
      .send({ name: 'Fête de test', days: 2, productionBonus: 0.5 })
      .expect(201);
    expect(launched.body).toMatchObject({ name: 'Fête de test', status: 'ACTIVE', auto: false });

    expect(await hourly(admin)).toBeCloseTo(before * 1.5, 5);
    const active = await request(app.getHttpServer()).get('/world-events/active').set(auth(admin)).expect(200);
    expect(active.body.events).toHaveLength(1);
    expect(active.body.effects.productionBonus).toBe(0.5);

    await request(app.getHttpServer()).delete(`/admin/world-events/${launched.body.id}`).set(auth(admin)).expect(200);
    expect(await hourly(admin)).toBeCloseTo(before, 5);
    await request(app.getHttpServer()).delete(`/admin/world-events/${launched.body.id}`).set(auth(admin)).expect(409);

    const audit = await database.adminAuditLog.findMany({ where: { userId: admin.userId }, select: { action: true } });
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining(['world_event_launch', 'world_event_cancel']));
  });

  it("règle la production avant le lancement : le temps déjà écoulé n'est pas compté avec le bonus", async () => {
    const admin = await account('ADMIN');
    const rate = await hourly(admin);
    const start = { metal: 1000, crystal: 1000, deuterium: 1000 };
    // Dernier règlement il y a 2 h : le lancement doit créditer 2 h de production NORMALE
    await database.planet.update({
      where: { id: admin.planetId },
      data: { ...start, lastUpdate: new Date(Date.now() - 2 * 3_600_000) },
    });
    await events.launchCustom(admin.userId, { name: 'Bonus', days: 1, productionBonus: 1 });
    const planet = await database.planet.findUniqueOrThrow({ where: { id: admin.planetId } });
    expect(planet.metal - start.metal).toBeGreaterThan(rate * 2 * 0.98);
    expect(planet.metal - start.metal).toBeLessThan(rate * 2 * 1.05);
    expect(Date.now() - planet.lastUpdate.getTime()).toBeLessThan(60_000);
  });

  it('refuse un événement sans effet, hors bornes ou sans nom', async () => {
    const admin = await account('ADMIN');
    const post = (body: Record<string, unknown>) =>
      request(app.getHttpServer()).post('/admin/world-events/launch-custom').set(auth(admin)).send(body);
    await post({ name: 'Vide', days: 1 }).expect(400);
    await post({ name: 'Trop gros', days: 1, productionBonus: 5 }).expect(400);
    await post({ name: 'Trop long', days: 400, productionBonus: 0.1 }).expect(400);
    await post({ name: '   ', days: 1, productionBonus: 0.1 }).expect(400);
    await post({ name: 'x'.repeat(61), days: 1, productionBonus: 0.1 }).expect(400);
    expect(await database.worldEvent.count()).toBe(0);
  });

  it('le calendrier propose des rappels ; un modèle lancé ne l’est qu’une fois par occurrence', async () => {
    const admin = await account('ADMIN');
    const overview = await request(app.getHttpServer()).get('/admin/world-events').set(auth(admin)).expect(200);
    expect(overview.body.templates.length).toBeGreaterThanOrEqual(5);
    expect(overview.body.templates.every((template: { auto: boolean }) => template.auto === false)).toBe(true);

    const template = overview.body.templates[0];
    await request(app.getHttpServer())
      .post('/admin/world-events/launch-template')
      .set(auth(admin))
      .send({ templateId: template.id, days: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/admin/world-events/launch-template')
      .set(auth(admin))
      .send({ templateId: template.id })
      .expect(409);
    await request(app.getHttpServer())
      .post('/admin/world-events/launch-template')
      .set(auth(admin))
      .send({ templateId: 'inconnu' })
      .expect(404);

    const after = await request(app.getHttpServer()).get('/admin/world-events').set(auth(admin)).expect(200);
    const launched = after.body.templates.find((entry: { id: string }) => entry.id === template.id);
    expect(launched).toMatchObject({ launched: true, reminder: false });
    expect(after.body.active).toHaveLength(1);
  });

  it('un rappel est levé quand la fenêtre approche et que rien n’est lancé', async () => {
    const template = getWorldEventTemplate('harvest_moon')!;
    const window = templateOccurrence(template, new Date('2026-09-20T00:00:00Z'));
    expect(window.phase).toBe('reminder');
    const overview = await events.adminOverview(new Date('2026-09-20T00:00:00Z'));
    const entry = overview.templates.find((item) => item.id === 'harvest_moon')!;
    expect(entry).toMatchObject({ phase: 'reminder', reminder: true, launched: false });
    expect(overview.reminders).toBeGreaterThanOrEqual(1);
  });

  it('la case « automatique » est décochée par défaut ; cochée, le cron lance une seule fois dans la fenêtre', async () => {
    const admin = await account('ADMIN');
    const insideWinter = new Date('2026-12-25T10:00:00Z');

    // Décochée : rien ne démarre seul
    expect(await events.tick(insideWinter)).toEqual({ ended: 0, launched: 0 });
    expect(await database.worldEvent.count()).toBe(0);

    await request(app.getHttpServer())
      .put('/admin/world-events/templates/winter_festival/auto')
      .set(auth(admin))
      .send({ auto: true })
      .expect(200);
    await request(app.getHttpServer())
      .put('/admin/world-events/templates/inconnu/auto')
      .set(auth(admin))
      .send({ auto: true })
      .expect(404);
    // Hors fenêtre : rien
    expect((await events.tick(new Date('2026-07-01T00:00:00Z'))).launched).toBe(0);

    expect(await events.tick(insideWinter)).toEqual({ ended: 0, launched: 1 });
    expect(await events.tick(insideWinter)).toEqual({ ended: 0, launched: 0 });
    const event = await database.worldEvent.findFirstOrThrow();
    expect(event).toMatchObject({ templateId: 'winter_festival', auto: true, status: 'ACTIVE', occurrenceKey: 'winter_festival:2026' });
    expect(event.endsAt).toEqual(new Date('2027-01-03T00:00:00Z'));

    // Annulé par l'administrateur : la case cochée ne le relance pas
    await events.end(admin.userId, event.id);
    expect(await events.tick(insideWinter)).toEqual({ ended: 0, launched: 0 });
  });

  it('le cron termine un événement échu après avoir réglé la production avec son bonus', async () => {
    const admin = await account('ADMIN');
    const rate = await hourly(admin);
    const created = await events.launchCustom(admin.userId, { name: 'Court', days: 1, productionBonus: 1 });
    // 1 h de production sous bonus (×2) non encore réglée, puis l'échéance passe
    await database.planet.update({
      where: { id: admin.planetId },
      data: { metal: 5000, lastUpdate: new Date(Date.now() - 3_600_000) },
    });
    await database.worldEvent.update({ where: { id: created.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    modifiers.invalidate();

    expect((await events.tick()).ended).toBe(1);
    const planet = await database.planet.findUniqueOrThrow({ where: { id: admin.planetId } });
    expect(planet.metal - 5000).toBeGreaterThan(rate * 2 * 0.98);
    expect(planet.metal - 5000).toBeLessThan(rate * 2 * 1.05);
    expect((await database.worldEvent.findUniqueOrThrow({ where: { id: created.id } })).status).toBe('ENDED');
    expect(await hourly(admin)).toBeCloseTo(rate, 5);
  });

  it('deux lancements simultanés du même modèle : un seul aboutit', async () => {
    const admin = await account('ADMIN');
    const results = await Promise.allSettled([
      events.launchTemplate(admin.userId, { templateId: 'dark_nebula', days: 2 }),
      events.launchTemplate(admin.userId, { templateId: 'dark_nebula', days: 2 }),
      events.launchTemplate(admin.userId, { templateId: 'dark_nebula', days: 2 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await database.worldEvent.count({ where: { templateId: 'dark_nebula' } })).toBe(1);
  });

  it('les effets de plusieurs événements actifs sont cumulés et bornés', async () => {
    const admin = await account('ADMIN');
    await events.launchCustom(admin.userId, { name: 'A', days: 1, productionBonus: 0.8 });
    await events.launchCustom(admin.userId, { name: 'B', days: 1, productionBonus: 0.8 });
    expect((await modifiers.effects()).productionBonus).toBe(1);
  });

  it('réduit la taxe du marché pendant un événement et la rétablit ensuite', async () => {
    const admin = await account('ADMIN');
    const seller = await account();
    const buyer = await account();
    const stock = { metal: 500_000, crystal: 300_000, deuterium: 200_000 };
    for (const who of [seller, buyer]) await database.planet.update({ where: { id: who.planetId }, data: stock });

    const sale = async () => {
      const offer = await request(app.getHttpServer())
        .post('/market/offers')
        .set(auth(seller))
        .send({ planetId: seller.planetId, give: 'metal', want: 'crystal', amount: 10_000, rate: 1 })
        .expect(201);
      const trade = await request(app.getHttpServer())
        .post(`/market/offers/${offer.body.id}/buy`)
        .set(auth(buyer))
        .send({ planetId: buyer.planetId, amount: 10_000 })
        .expect(201);
      return trade.body.tax as number;
    };

    expect(await sale()).toBe(500); // 5 % de 10 000
    const created = await events.launchCustom(admin.userId, { name: 'Marché libre', days: 1, marketTaxReduction: 0.5 });
    const rules = await request(app.getHttpServer()).get('/market/offers').set(auth(buyer)).expect(200);
    expect(rules.body.rules.taxRate).toBeCloseTo(0.025);
    expect(await sale()).toBe(250);
    await events.end(admin.userId, created.id);
    expect(await sale()).toBe(500);
  });
});
