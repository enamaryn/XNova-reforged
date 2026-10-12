import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MAX_GROUP_FLEETS } from '@xnova/game-config';
import { CombatService } from '../../src/combat/combat.service';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp, registerAndLogin } from './helpers';

/**
 * Attaques groupées : les membres d'une alliance rejoignent un groupe qui arrive en même temps sur la cible ;
 * un seul combat, un rapport par participant, butin partagé au prorata de la place libre, expérience de chaque
 * commandant, groupe supprimé après le combat.
 */
describe('API integration - attaques groupées', () => {
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

  let regionBase = 100;
  let placed = 0;
  beforeEach(() => {
    regionBase = 50 + Math.floor(Math.random() * 380);
    placed = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const id of alliances) await database.alliance.deleteMany({ where: { id } });
    for (const user of users) await cleanupTestUser(database, user.username);
    if (app) await app.close();
  });

  const player = async (cruisers = 100) => {
    const user = buildTestUser();
    users.push(user);
    const { accessToken } = await registerAndLogin(app, user);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const p = me.body.planets[0];
    // Tous les joueurs d'un test vivent dans la même région (même galaxie, systèmes voisins) : carburant faible
    // et durées comparables, quel que soit le tirage des coordonnées d'inscription
    let coords = { galaxy: 9, system: regionBase + (placed % 6), position: 1 + Math.floor(Math.random() * 15) };
    placed += 1;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await database.planet.update({ where: { id: p.id }, data: coords });
        break;
      } catch {
        coords = { ...coords, position: 1 + Math.floor(Math.random() * 15) };
      }
    }
    const u = {
      token: accessToken as string,
      userId: me.body.id as string,
      planetId: p.id as string,
      coords,
    };
    // sous la capacité de stockage de départ : le règlement de production ne rogne rien
    await database.planet.update({ where: { id: u.planetId }, data: { deuterium: 1_000_000, metal: 200_000, crystal: 100_000 } });
    if (cruisers > 0) await database.ship.create({ data: { planetId: u.planetId, shipId: 206, amount: cruisers } });
    return u;
  };
  type Player = Awaited<ReturnType<typeof player>>;
  const auth = (u: Player) => ({ Authorization: `Bearer ${u.token}` });
  let tagSeq = 0;
  const ally = async (...members: Player[]) => {
    tagSeq += 1;
    const alliance = await database.alliance.create({
      data: { tag: `G${Date.now().toString(36).slice(-3).toUpperCase()}${tagSeq}`.slice(0, 5), name: 'Test ACS', founderId: members[0].userId },
    });
    alliances.push(alliance.id);
    for (const m of members) {
      await database.allianceMember.create({ data: { allianceId: alliance.id, userId: m.userId, rank: 'member' } });
    }
    return alliance;
  };
  const acs = (u: Player, target: Player, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/fleet/send')
      .set(auth(u))
      .send({
        planetId: u.planetId, toGalaxy: target.coords.galaxy, toSystem: target.coords.system, toPosition: target.coords.position,
        // le créateur part lentement (10 %) : les alliés, plus ou moins loin de la cible, peuvent le rattraper
        mission: 2, speedPercent: body.groupId ? 100 : 10, ships: { '206': 10 }, cargo: {}, ...body,
      });
  const groups = async (u: Player) => (await request(app.getHttpServer()).get('/fleet/attack-groups').set(auth(u)).expect(200)).body;
  const makeDue = (fleetId: string) =>
    database.fleet.update({
      where: { id: fleetId },
      data: { startTime: new Date(Date.now() - 360_000), arrivalTime: new Date(Date.now() - 60_000), returnTime: new Date(Date.now() + 240_000) },
    });
  const cargoTotal = (cargo: any) => Number(cargo.metal ?? 0) + Number(cargo.crystal ?? 0) + Number(cargo.deuterium ?? 0);

  describe('création et adhésion', () => {
    it("exige une alliance, une cible hors alliance et d'autres joueurs que soi", async () => {
      const a = await player();
      const b = await player();
      const target = await player(0);
      const noAlliance = await acs(a, target).expect(400);
      expect(noAlliance.body.message).toMatch(/alliance/);

      await ally(a, b);
      await acs(a, a).expect(400); // sa propre planète
      await acs(a, b).expect(400); // un allié
      // un groupe ne se rejoint qu'avec la mission d'attaque groupée
      await request(app.getHttpServer()).post('/fleet/send').set(auth(a))
        .send({ planetId: a.planetId, toGalaxy: target.coords.galaxy, toSystem: target.coords.system, toPosition: target.coords.position, mission: 1, speedPercent: 100, ships: { '206': 1 }, cargo: {}, groupId: 'x' })
        .expect(400);
      expect(await database.attackGroup.count({ where: { creatorId: a.userId } })).toBe(0);
    });

    it('la première flotte crée le groupe, les alliés le voient et le rejoignent à la même heure', async () => {
      const a = await player();
      const b = await player();
      const outsider = await player();
      const target = await player(0);
      await ally(a, b);

      const created = await acs(a, target).expect(201);
      expect(created.body.groupId).toBeTruthy();
      expect((await groups(b)).groups).toEqual([
        expect.objectContaining({ id: created.body.groupId, creator: expect.any(String), fleets: 1, target: expect.objectContaining(target.coords) }),
      ]);
      expect((await groups(outsider)).groups).toEqual([]);

      const joined = await acs(b, target, { groupId: created.body.groupId }).expect(201);
      expect(joined.body.groupId).toBe(created.body.groupId);
      expect(new Date(joined.body.arrivalTime).getTime()).toBe(new Date(created.body.arrivalTime).getTime());
      const fleets = await database.fleet.findMany({ where: { groupId: created.body.groupId } });
      expect(fleets).toHaveLength(2);
      expect((await groups(a)).groups[0].fleets).toBe(2);
    });

    it('refuse un groupe étranger, une autre cible, un groupe déjà parti, une flotte trop lente et un groupe complet', async () => {
      const a = await player();
      const b = await player();
      const outsider = await player();
      const target = await player(0);
      const other = await player(0);
      await ally(a, b);
      await ally(outsider, await player());

      const created = await acs(a, target).expect(201);
      const groupId = created.body.groupId as string;
      await acs(outsider, target, { groupId }).expect(404); // pas de la même alliance
      await acs(b, other, { groupId }).expect(400); // autre cible
      await acs(b, target, { groupId: 'inexistant' }).expect(404);

      // le groupe arrive dans 1 s : aucune flotte ne peut le rattraper
      await database.attackGroup.update({ where: { id: groupId }, data: { arrivalTime: new Date(Date.now() + 1000) } });
      const slow = await acs(b, target, { groupId }).expect(400);
      expect(slow.body.message).toMatch(/lente/);
      await database.attackGroup.update({ where: { id: groupId }, data: { arrivalTime: new Date(Date.now() - 1000) } });
      const gone = await acs(b, target, { groupId }).expect(400);
      expect(gone.body.message).toMatch(/parti/);

      // groupe complet
      await database.attackGroup.update({ where: { id: groupId }, data: { arrivalTime: new Date(Date.now() + 10 * 3600_000) } });
      for (let i = 1; i < MAX_GROUP_FLEETS; i += 1) {
        await database.fleet.create({
          data: {
            userId: a.userId, fromGalaxy: a.coords.galaxy, fromSystem: a.coords.system, fromPosition: a.coords.position,
            toGalaxy: target.coords.galaxy, toSystem: target.coords.system, toPosition: target.coords.position,
            mission: 2, ships: { '206': 1 }, cargo: {}, startTime: new Date(), arrivalTime: new Date(Date.now() + 10 * 3600_000),
            status: 'traveling', groupId,
          } as any,
        });
      }
      const full = await acs(b, target, { groupId }).expect(400);
      expect(full.body.message).toMatch(/complet/);
    });
  });

  describe('combat groupé', () => {
    it('un seul combat, un rapport par participant, butin partagé au prorata de la place libre', async () => {
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const a = await player(300);
      const b = await player(100);
      const target = await player(0);
      await ally(a, b);
      await database.ship.create({ data: { planetId: target.planetId, shipId: 204, amount: 400 } });
      await database.planet.update({ where: { id: target.planetId }, data: { metal: 200_000, crystal: 100_000, deuterium: 50_000 } });

      const first = await acs(a, target, { ships: { '206': 300 } }).expect(201);
      const second = await acs(b, target, { ships: { '206': 100 }, groupId: first.body.groupId }).expect(201);
      await makeDue(first.body.fleetId);
      await makeDue(second.body.fleetId);
      await fleetCron.processArrivals();

      // un rapport par attaquant (même défenseur), avec la liste des participants
      const reportA = await database.combatReport.findFirstOrThrow({ where: { attackerId: a.userId, defenderId: target.userId } });
      const reportB = await database.combatReport.findFirstOrThrow({ where: { attackerId: b.userId, defenderId: target.userId } });
      expect(reportA.result).toBe('attacker_win');
      expect(reportB.result).toBe('attacker_win');
      const participants = reportA.participants as any[];
      expect(participants).toHaveLength(2);
      expect(participants.map((p) => p.userId).sort()).toEqual([a.userId, b.userId].sort());
      expect(participants.find((p) => p.userId === a.userId).ships['206']).toBe(300);
      expect(await database.combatReport.count({ where: { defenderId: target.userId } })).toBe(2);

      // les deux flottes rentrent avec leur part du butin (3 contre 1), au total la moitié des stocks
      const fleetA = await database.fleet.findUniqueOrThrow({ where: { id: first.body.fleetId } });
      const fleetB = await database.fleet.findUniqueOrThrow({ where: { id: second.body.fleetId } });
      expect(fleetA.status).toBe('returning');
      expect(fleetB.status).toBe('returning');
      const loadA = cargoTotal(fleetA.cargo);
      const loadB = cargoTotal(fleetB.cargo);
      expect(loadA + loadB).toBe(100_000 + 50_000 + 25_000);
      expect(loadA).toBeGreaterThan(loadB * 2);
      expect(loadB).toBeGreaterThan(0);

      // le groupe n'existe plus
      expect(await database.attackGroup.count({ where: { id: first.body.groupId } })).toBe(0);
    });

    it('chaque commandant de chaque flotte gagne de l’expérience', async () => {
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const a = await player(300);
      const b = await player(100);
      const target = await player(0);
      await ally(a, b);
      await database.ship.create({ data: { planetId: target.planetId, shipId: 204, amount: 400 } });
      const ca = await database.fleetCommander.create({ data: { userId: a.userId, name: 'Alpha' } });
      const cb = await database.fleetCommander.create({ data: { userId: b.userId, name: 'Beta' } });
      const first = await acs(a, target, { ships: { '206': 300 }, commanderId: ca.id }).expect(201);
      const second = await acs(b, target, { ships: { '206': 100 }, groupId: first.body.groupId, commanderId: cb.id }).expect(201);
      await makeDue(first.body.fleetId);
      await makeDue(second.body.fleetId);
      await fleetCron.processArrivals();
      expect((await database.fleetCommander.findUniqueOrThrow({ where: { id: ca.id } })).experience).toBeGreaterThan(100);
      expect((await database.fleetCommander.findUniqueOrThrow({ where: { id: cb.id } })).experience).toBeGreaterThan(100);
    });

    it('une flotte rappelée quitte le groupe : le combat se fait avec les flottes restantes', async () => {
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const a = await player(300);
      const b = await player(100);
      const target = await player(0);
      await ally(a, b);
      await database.ship.create({ data: { planetId: target.planetId, shipId: 204, amount: 50 } });
      const first = await acs(a, target, { ships: { '206': 300 } }).expect(201);
      const second = await acs(b, target, { ships: { '206': 100 }, groupId: first.body.groupId }).expect(201);
      await request(app.getHttpServer()).delete(`/fleet/${first.body.fleetId}`).set(auth(a)).expect(200);
      await makeDue(second.body.fleetId);
      await fleetCron.processArrivals();
      const report = await database.combatReport.findFirstOrThrow({ where: { attackerId: b.userId, defenderId: target.userId } });
      expect(report.participants).toBeNull(); // un seul attaquant : combat simple
      expect((await database.fleet.findUniqueOrThrow({ where: { id: second.body.fleetId } })).status).toBe('returning');
      expect((await database.fleet.findUniqueOrThrow({ where: { id: first.body.fleetId } })).status).toBe('returning');
    });

    it('une flotte seule, sans groupe créé par un autre, combat comme une attaque classique', async () => {
      jest.spyOn(CombatService.prototype as any, 'rollMoon').mockReturnValue(false);
      const a = await player(300);
      const b = await player(0);
      const target = await player(0);
      await ally(a, b);
      await database.ship.create({ data: { planetId: target.planetId, shipId: 204, amount: 100 } });
      const only = await acs(a, target, { ships: { '206': 300 } }).expect(201);
      await makeDue(only.body.fleetId);
      await fleetCron.processArrivals();
      const report = await database.combatReport.findFirstOrThrow({ where: { attackerId: a.userId, defenderId: target.userId } });
      expect(report.result).toBe('attacker_win');
      expect(await database.attackGroup.count({ where: { id: only.body.groupId } })).toBe(0);
    });
  });
});
