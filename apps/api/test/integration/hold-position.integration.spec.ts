import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Maintien de position et dépôt d'alliance : une flotte se pose chez un allié pour 1 à 32 heures (carburant payé
 * d'avance), le dépôt de l'hôte rembourse ce carburant dans sa limite, la flotte défend l'hôte pendant le
 * maintien puis rentre ; le rappel est possible à tout moment.
 */
describe('API integration - maintien de position et dépôt d\'alliance', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;
  const users: ReturnType<typeof buildTestUser>[] = [];
  const alliances: string[] = [];

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);
  });

  afterAll(async () => {
    for (const id of alliances) await database.alliance.deleteMany({ where: { id } });
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  const player = async () => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const p = me.body.planets[0];
    const u = {
      token: accessToken as string,
      userId: me.body.id as string,
      planetId: p.id as string,
      coords: { galaxy: p.galaxy as number, system: p.system as number, position: p.position as number },
    };
    await database.ship.create({ data: { planetId: u.planetId, shipId: 202, amount: 20 } });
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 100000 } });
    return u;
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  let tagSeq = 0;
  const ally = async (...members: Player[]) => {
    tagSeq += 1;
    const alliance = await database.alliance.create({
      data: { tag: `H${Date.now().toString(36).slice(-3).toUpperCase()}${tagSeq}`.slice(0, 5), name: 'Test hold', founderId: members[0].userId },
    });
    alliances.push(alliance.id);
    for (const m of members) {
      await database.allianceMember.create({ data: { allianceId: alliance.id, userId: m.userId, rank: 'member' } });
    }
    return alliance;
  };
  const hold = (u: Player, host: Player, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set(auth(u))
      .send({
        planetId: u.planetId, toGalaxy: host.coords.galaxy, toSystem: host.coords.system, toPosition: host.coords.position,
        mission: 5, speedPercent: 100,
        ships: { '202': 10 }, cargo: {}, holdHours: 4, ...body,
      });
  const makeDue = (fleetId: string) =>
    database.fleet.update({
      where: { id: fleetId },
      data: { startTime: new Date(Date.now() - 360_000), arrivalTime: new Date(Date.now() - 60_000), returnTime: new Date(Date.now() + 240_000) },
    });
  const deut = async (planetId: string) =>
    (await database.planet.findUniqueOrThrow({ where: { id: planetId } })).deuterium;

  describe('envoi', () => {
    it('exige un allié, une durée de 1 à 32 h, et refuse sa propre planète', async () => {
      const a = await player();
      const b = await player();
      const stranger = await player();
      const noAlliance = await hold(a, b).expect(400);
      expect(noAlliance.body.message).toMatch(/alliance/);

      await ally(a, b);
      await hold(a, stranger).expect(400); // hors alliance
      await hold(a, a).expect(400); // propre planète
      await hold(a, b, { holdHours: 0 }).expect(400);
      await hold(a, b, { holdHours: 33 }).expect(400);
      await hold(a, b, { holdHours: undefined }).expect(400);
      await hold(a, b, { holdHours: 1.5 }).expect(400);
      // La durée n'a de sens que pour le maintien de position
      await request(app.getHttpServer()).post('/fleet/send').set(auth(a))
        .send({ planetId: a.planetId, toGalaxy: b.coords.galaxy, toSystem: b.coords.system, toPosition: b.coords.position, mission: 3, speedPercent: 100, ships: { '202': 1 }, cargo: {}, holdHours: 2 })
        .expect(400);
      expect(await database.fleet.count({ where: { userId: a.userId } })).toBe(0);
    });

    it('débite le carburant de trajet et de maintien (un dixième de la consommation par heure)', async () => {
      const a = await player();
      const b = await player();
      await ally(a, b);
      const before = await deut(a.planetId);
      const res = await hold(a, b).expect(201);
      // 10 petits transporteurs : 10 × 10 / 10 = 10 par heure × 4 h
      expect(res.body.holdFuel).toBe(40);
      expect(await deut(a.planetId)).toBe(before - res.body.fuelConsumption - 40);
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet).toMatchObject({ mission: 5, holdHours: 4, status: 'traveling' });
    });
  });

  describe('maintien et dépôt', () => {
    it('sans dépôt : la flotte se pose, reste jusqu\'à la fin du maintien puis rentre avec ses vaisseaux', async () => {
      const a = await player();
      const b = await player();
      await ally(a, b);
      const res = await hold(a, b).expect(201);
      await makeDue(res.body.fleetId);
      await fleetCron.processArrivals();
      let fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet.status).toBe('holding');
      expect(fleet.holdUntil!.getTime()).toBeGreaterThan(Date.now());
      expect((fleet.cargo as any).deuterium ?? 0).toBe(0);

      // Fin du maintien
      await database.fleet.update({ where: { id: fleet.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
      await fleetCron.processHolds();
      fleet = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
      expect(fleet.status).toBe('returning');
      expect(fleet.returnTime!.getTime()).toBeGreaterThan(Date.now());

      await database.fleet.update({ where: { id: fleet.id }, data: { returnTime: new Date(Date.now() - 1000) } });
      await fleetCron.processReturns();
      const home = await database.ship.findUniqueOrThrow({ where: { planetId_shipId: { planetId: a.planetId, shipId: 202 } } });
      expect(home.amount).toBe(20);
    });

    it('avec dépôt : l\'hôte rembourse le carburant de maintien dans la limite de son deutérium', async () => {
      const a = await player();
      const b = await player();
      await ally(a, b);
      await database.planet.update({ where: { id: b.planetId }, data: { allianceDepot: 1, deuterium: 25 } });
      const res = await hold(a, b).expect(201); // carburant de maintien : 40
      await makeDue(res.body.fleetId);
      await fleetCron.processArrivals();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      // L'hôte n'a que 25 de deutérium : il en fournit 25, remboursés en cargaison de retour
      expect((fleet.cargo as any).deuterium).toBe(25);
      expect(await deut(b.planetId)).toBe(0);

      // Avec assez de deutérium, tout le carburant payé est remboursé
      await database.fleet.update({ where: { id: fleet.id }, data: { status: 'completed' } });
      await database.planet.update({ where: { id: b.planetId }, data: { deuterium: 10000 } });
      const second = await hold(a, b, { ships: { '202': 5 } }).expect(201); // 5 × 10 / 10 = 5 par heure × 4 h = 20
      expect(second.body.holdFuel).toBe(20);
      await makeDue(second.body.fleetId);
      await fleetCron.processArrivals();
      const f2 = await database.fleet.findUniqueOrThrow({ where: { id: second.body.fleetId } });
      expect((f2.cargo as any).deuterium).toBe(20);
      expect(await deut(b.planetId)).toBe(9980);
    });

    it('hôte qui a quitté l\'alliance entre-temps : la flotte rentre sans se poser', async () => {
      const a = await player();
      const b = await player();
      await ally(a, b);
      const res = await hold(a, b).expect(201);
      await database.allianceMember.deleteMany({ where: { userId: b.userId } });
      await makeDue(res.body.fleetId);
      await fleetCron.processArrivals();
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(fleet.holdUntil).toBeNull();
    });

    it('rappel pendant le maintien : retour immédiat ; le maintien compte parmi les flottes en vol', async () => {
      const a = await player();
      const b = await player();
      await ally(a, b);
      const res = await hold(a, b).expect(201);
      await makeDue(res.body.fleetId);
      await fleetCron.processArrivals();
      // Une seule flotte en vol autorisée (Ordinateur 0) : le maintien occupe l'emplacement
      await hold(a, b).expect(400);

      await request(app.getHttpServer()).delete(`/fleet/${res.body.fleetId}`).set(auth(b)).expect(403);
      await request(app.getHttpServer()).delete(`/fleet/${res.body.fleetId}`).set(auth(a)).expect(200);
      const fleet = await database.fleet.findUniqueOrThrow({ where: { id: res.body.fleetId } });
      expect(fleet.status).toBe('returning');
      expect(fleet.holdUntil).toBeNull();
    });
  });

  describe('défense alliée', () => {
    const attackFleet = (attacker: Player, host: Player, ships: Record<string, number>) =>
      database.fleet.create({
        data: {
          userId: attacker.userId,
          fromGalaxy: attacker.coords.galaxy, fromSystem: attacker.coords.system, fromPosition: attacker.coords.position,
          toGalaxy: host.coords.galaxy, toSystem: host.coords.system, toPosition: host.coords.position,
          mission: 1, ships, cargo: {},
          startTime: new Date(Date.now() - 120_000), arrivalTime: new Date(Date.now() - 60_000),
          returnTime: new Date(Date.now() + 60_000), status: 'traveling',
        } as any,
      });

    it('les flottes en maintien combattent avec l\'hôte et partagent ses pertes au prorata', async () => {
      const host = await player();
      const holder = await player();
      const attacker = await player();
      await ally(host, holder);
      // L'hôte garde 30 chasseurs légers ; son allié se pose avec 70 autres
      await database.ship.deleteMany({ where: { planetId: host.planetId } });
      await database.ship.create({ data: { planetId: host.planetId, shipId: 204, amount: 30 } });
      const stay = await database.fleet.create({
        data: {
          userId: holder.userId,
          fromGalaxy: holder.coords.galaxy, fromSystem: holder.coords.system, fromPosition: holder.coords.position,
          toGalaxy: host.coords.galaxy, toSystem: host.coords.system, toPosition: host.coords.position,
          mission: 5, ships: { '204': 70 }, cargo: {}, holdHours: 8, holdUntil: new Date(Date.now() + 3600_000),
          startTime: new Date(Date.now() - 600_000), arrivalTime: new Date(Date.now() - 300_000),
          returnTime: new Date(Date.now() + 3600_000), status: 'holding',
        } as any,
      });
      await database.ship.create({ data: { planetId: attacker.planetId, shipId: 206, amount: 100 } });
      await attackFleet(attacker, host, { '206': 100 });

      await fleetCron.processArrivals();

      const report = await database.combatReport.findFirstOrThrow({ where: { attackerId: attacker.userId } });
      // Les 100 chasseurs (30 de l'hôte + 70 de l'allié) combattent ensemble
      expect(report.defenderShips).toMatchObject({ '204': 100 });
      const totalLost = Number((report.defenderLosses as any)['204'] ?? 0);
      expect(totalLost).toBeGreaterThan(0);
      const hostLeft = (await database.ship.findUniqueOrThrow({
        where: { planetId_shipId: { planetId: host.planetId, shipId: 204 } },
      })).amount;
      const after = await database.fleet.findUniqueOrThrow({ where: { id: stay.id } });
      const holderLeft = Number((after.ships as Record<string, number>)['204'] ?? 0);
      // Le total des survivants + des pertes fait 100 ; l'hôte porte environ 30 % des pertes
      expect(hostLeft + holderLeft + totalLost).toBe(100);
      const hostLost = 30 - hostLeft;
      expect(Math.abs(hostLost - 0.3 * totalLost)).toBeLessThanOrEqual(1);
      expect(after.status).toBe(holderLeft > 0 ? 'holding' : 'completed');
    });

    it('sans flotte alliée, la même attaque ne trouve que les vaisseaux de l\'hôte', async () => {
      const host = await player();
      const attacker = await player();
      await database.ship.deleteMany({ where: { planetId: host.planetId } });
      await database.ship.create({ data: { planetId: attacker.planetId, shipId: 206, amount: 100 } });
      await attackFleet(attacker, host, { '206': 100 });
      await fleetCron.processArrivals();
      const report = await database.combatReport.findFirstOrThrow({ where: { attackerId: attacker.userId } });
      expect(report.result).toBe('attacker_win');
      expect(report.defenderShips).toEqual({});
    });
  });

  describe('galaxie', () => {
    it('signale les planètes alliées (isAllied) pour proposer le maintien', async () => {
      const a = await player();
      const b = await player();
      const c = await player();
      await ally(a, b);
      const view = await request(app.getHttpServer())
        .get(`/galaxy/${b.coords.galaxy}/${b.coords.system}`).set(auth(a)).expect(200);
      const slot = view.body.positions.find((p: { position: number }) => p.position === b.coords.position);
      expect(slot.isAllied).toBe(true);
      const other = await request(app.getHttpServer())
        .get(`/galaxy/${c.coords.galaxy}/${c.coords.system}`).set(auth(a)).expect(200);
      const cs = other.body.positions.find((p: { position: number }) => p.position === c.coords.position);
      expect(cs.isAllied).toBe(false);
    });
  });
});
