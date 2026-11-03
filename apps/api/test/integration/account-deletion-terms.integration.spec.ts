import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { LEGAL_VERSION } from '@xnova/game-config';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, cleanupTestUser, createIntegrationApp } from './helpers';

/**
 * Acceptation des conditions d'utilisation à l'inscription et suppression définitive du compte.
 */
describe('API integration - Acceptation des textes légaux et suppression de compte', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const created: string[] = [];

  const server = () => app.getHttpServer();

  const signUp = async () => {
    const user = buildTestUser();
    created.push(user.username);
    const res = await request(server()).post('/auth/register').send(user).expect(201);
    return {
      user,
      userId: res.body.user.id as string,
      access: res.body.tokens.accessToken as string,
    };
  };

  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });
  const remove = (token: string, password: string) =>
    request(server()).post('/auth/delete-account').set(authed(token)).send({ password });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
  });

  afterAll(async () => {
    for (const username of created) await cleanupTestUser(database, username);
    if (app) await app.close();
  });

  describe('acceptation à l’inscription', () => {
    it('refuse l’inscription sans acceptation, ou avec acceptation à false', async () => {
      const user = buildTestUser();
      created.push(user.username);
      const { acceptTerms: _omit, ...withoutField } = user;
      await request(server()).post('/auth/register').send(withoutField).expect(400);
      await request(server()).post('/auth/register').send({ ...user, acceptTerms: false }).expect(400);
      expect(await database.user.count({ where: { username: user.username } })).toBe(0);
    });

    it('enregistre la date et la version des textes acceptés', async () => {
      const { userId, access } = await signUp();
      const row = await database.user.findUniqueOrThrow({ where: { id: userId } });
      expect(row.termsVersion).toBe(LEGAL_VERSION);
      expect(row.termsAcceptedAt).toBeInstanceOf(Date);

      const me = await request(server()).get('/auth/me').set(authed(access)).expect(200);
      expect(me.body.termsCurrent).toBe(true);
      expect(me.body.legalVersion).toBe(LEGAL_VERSION);
    });

    it('un compte antérieur ou une version périmée est invité à accepter, puis accepte', async () => {
      const { userId, access } = await signUp();
      await database.user.update({ where: { id: userId }, data: { termsAcceptedAt: null, termsVersion: null } });
      const before = await request(server()).get('/auth/me').set(authed(access)).expect(200);
      expect(before.body.termsCurrent).toBe(false);

      await request(server()).post('/auth/accept-terms').set(authed(access)).expect(200);
      const after = await database.user.findUniqueOrThrow({ where: { id: userId } });
      expect(after.termsVersion).toBe(LEGAL_VERSION);
      const me = await request(server()).get('/auth/me').set(authed(access)).expect(200);
      expect(me.body.termsCurrent).toBe(true);

      await database.user.update({ where: { id: userId }, data: { termsVersion: '2000-01-01' } });
      expect((await request(server()).get('/auth/me').set(authed(access))).body.termsCurrent).toBe(false);
    });

    it('accept-terms exige une session', async () => {
      await request(server()).post('/auth/accept-terms').expect(401);
    });
  });

  describe('suppression du compte', () => {
    it('refuse sans session et avec un mauvais mot de passe, sans rien supprimer', async () => {
      const { user, userId, access } = await signUp();
      await request(server()).post('/auth/delete-account').send({ password: user.password }).expect(401);
      await remove(access, 'Mauvais1234!').expect(401);
      expect(await database.user.count({ where: { id: userId } })).toBe(1);
    });

    it('supprime le compte, ses planètes et ses sessions ; le jeton et la connexion cessent de marcher', async () => {
      const { user, userId, access } = await signUp();
      expect(await database.planet.count({ where: { userId } })).toBeGreaterThan(0);

      await remove(access, user.password).expect(200);

      expect(await database.user.count({ where: { id: userId } })).toBe(0);
      expect(await database.planet.count({ where: { userId } })).toBe(0);
      expect(await database.session.count({ where: { userId } })).toBe(0);
      await request(server()).get('/auth/me').set(authed(access)).expect(401);
      await request(server())
        .post('/auth/login')
        .send({ identifier: user.username, password: user.password })
        .expect(401);

      // Le nom et l'adresse sont de nouveau libres
      await request(server()).post('/auth/register').send(user).expect(201);
    });

    it('supprime aussi les messages, les références sans clé étrangère et les restes d’identifiant', async () => {
      const a = await signUp();
      const b = await signUp();
      await database.message.create({ data: { fromId: a.userId, toId: b.userId, subject: 's', body: 'c' } });
      await database.message.create({ data: { fromId: b.userId, toId: a.userId, subject: 's', body: 'c' } });
      const boss = await database.galacticBoss.create({
        data: { nameId: 1, galaxy: 1, system: 1, ships: {}, maxShips: {}, status: 'DEAD' },
      });
      await database.bossDamage.create({ data: { bossId: boss.id, userId: a.userId, planetId: randomUUID(), damage: 10, battles: 1 } });
      const [first, second] = [a.userId, b.userId].sort();
      await database.accountLinkExemption.create({ data: { userA: first, userB: second, reason: 'test' } });
      const incident = await database.incident.create({
        data: {
          fingerprint: `del-${randomUUID()}`,
          level: 'error',
          source: 'api',
          message: 'm',
          userId: a.userId,
        },
      });

      await remove(a.access, a.user.password).expect(200);

      expect(await database.message.count({ where: { OR: [{ fromId: a.userId }, { toId: a.userId }] } })).toBe(0);
      expect(await database.bossDamage.count({ where: { userId: a.userId } })).toBe(0);
      expect(await database.accountLinkExemption.count({ where: { OR: [{ userA: a.userId }, { userB: a.userId }] } })).toBe(0);
      expect((await database.incident.findUniqueOrThrow({ where: { id: incident.id } })).userId).toBeNull();
      // L'autre joueur est intact
      expect(await database.user.count({ where: { id: b.userId } })).toBe(1);

      await database.incident.delete({ where: { id: incident.id } });
      await database.galacticBoss.delete({ where: { id: boss.id } });
    });

    it('refuse tant qu’une flotte ou un missile est en vol, puis accepte une fois rentré', async () => {
      const { user, userId, access } = await signUp();
      const planet = await database.planet.findFirstOrThrow({ where: { userId } });
      const fleet = await database.fleet.create({
        data: {
          userId,
          fromGalaxy: planet.galaxy,
          fromSystem: planet.system,
          fromPosition: planet.position,
          toGalaxy: planet.galaxy,
          toSystem: planet.system,
          toPosition: 16,
          mission: 15,
          ships: { '210': 1 },
          cargo: {},
          status: 'traveling',
          startTime: new Date(),
          arrivalTime: new Date(Date.now() + 3600_000),
        },
      });
      const refused = await remove(access, user.password).expect(409);
      expect(String(refused.body.message)).toContain('en vol');
      expect(await database.user.count({ where: { id: userId } })).toBe(1);

      await database.fleet.update({ where: { id: fleet.id }, data: { status: 'completed' } });
      await remove(access, user.password).expect(200);
    });

    it('refuse un compte d’administration', async () => {
      const { user, userId, access } = await signUp();
      await database.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
      await remove(access, user.password).expect(403);
      expect(await database.user.count({ where: { id: userId } })).toBe(1);
    });

    it('fondateur d’alliance : la fondation passe au membre le plus gradé, ou l’alliance disparaît s’il est seul', async () => {
      const founder = await signUp();
      const officer = await signUp();
      const member = await signUp();
      const alliance = await database.alliance.create({
        data: { tag: randomUUID().slice(0, 5), name: 'Alliance suppression', founderId: founder.userId },
      });
      await database.allianceMember.createMany({
        data: [
          { allianceId: alliance.id, userId: founder.userId, rank: 'founder' },
          { allianceId: alliance.id, userId: member.userId, rank: 'member' },
          { allianceId: alliance.id, userId: officer.userId, rank: 'officer' },
        ],
      });

      await remove(founder.access, founder.user.password).expect(200);
      const after = await database.alliance.findUniqueOrThrow({ where: { id: alliance.id } });
      expect(after.founderId).toBe(officer.userId);
      expect((await database.allianceMember.findUniqueOrThrow({ where: { userId: officer.userId } })).rank).toBe('founder');
      expect(await database.allianceMember.count({ where: { allianceId: alliance.id } })).toBe(2);

      // Un membre ordinaire qui part ne touche pas l'alliance
      await remove(member.access, member.user.password).expect(200);
      expect(await database.alliance.count({ where: { id: alliance.id } })).toBe(1);

      // Le dernier membre, fondateur : l'alliance disparaît
      await remove(officer.access, officer.user.password).expect(200);
      expect(await database.alliance.count({ where: { id: alliance.id } })).toBe(0);
    });
  });
});
