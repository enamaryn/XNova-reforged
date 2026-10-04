import { ConflictException, INestApplication, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../../src/auth/auth.service';
import { DatabaseService } from '../../src/database/database.service';
import { buildTestUser, createIntegrationApp } from './helpers';

/**
 * OPS-02 — inscription atomique : aucun compte sans planète, collisions de position reprises
 * de façon bornée, conflits de nom/email en 409 même sous concurrence.
 */
describe('API integration - Inscription atomique (OPS-02)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let auth: AuthService;
  const created: string[] = [];

  const newUser = () => {
    const user = buildTestUser();
    created.push(user.username);
    return user;
  };

  /** Première position libre d'une zone de test (sans jamais supprimer la planète d'une autre suite). */
  const findFreePosition = async (galaxy: number, system: number) => {
    for (let position = 1; position <= 15; position += 1) {
      const taken = await database.planet.findUnique({
        where: { galaxy_system_position: { galaxy, system, position } },
      });
      if (!taken) return { galaxy, system, position };
    }
    throw new Error('zone de test saturée');
  };

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    auth = app.get(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await database.user.deleteMany({ where: { username: { in: created } } });
    if (app) await app.close();
  });

  describe('échec injecté : aucune inscription partielle', () => {
    it('échec de la création de la planète : ni compte, ni planète, ni session', async () => {
      const user = newUser();
      jest.spyOn(auth as any, 'createStarterPlanet').mockRejectedValue(new Error('panne injectée'));

      await expect(auth.register(user)).rejects.toThrow('panne injectée');

      // Les planètes et sessions référencent l'utilisateur par clé étrangère : sans compte, aucun résidu possible
      expect(await database.user.findUnique({ where: { username: user.username } })).toBeNull();
      expect(await database.user.count({ where: { email: user.email } })).toBe(0);
    });

    it('échec de la création de la session après la planète : tout est annulé', async () => {
      const user = newUser();
      jest.spyOn(auth as any, 'createSessionTokens').mockRejectedValue(new Error('panne session'));

      await expect(auth.register(user)).rejects.toThrow('panne session');

      expect(await database.user.findUnique({ where: { username: user.username } })).toBeNull();
      expect(await database.user.count({ where: { email: user.email } })).toBe(0);
    });

    it('après un échec, la même inscription peut être refaite', async () => {
      const user = newUser();
      const spy = jest
        .spyOn(auth as any, 'createStarterPlanet')
        .mockRejectedValueOnce(new Error('panne injectée'));

      await expect(auth.register(user)).rejects.toThrow('panne injectée');
      spy.mockRestore();

      const result = await auth.register(user);
      expect(result.user.username).toBe(user.username);
      expect(await database.planet.count({ where: { userId: result.user.id } })).toBe(1);
    });
  });

  describe('collisions de position : reprise bornée', () => {
    it('reprend avec de nouvelles coordonnées après des collisions', async () => {
      const owner = newUser();
      const occupied = await auth.register(owner);
      const taken = await database.planet.findFirstOrThrow({ where: { userId: occupied.user.id } });
      const free = await findFreePosition(9, 465);

      const pick = jest
        .spyOn(auth as any, 'pickStarterCoordinates')
        .mockReturnValueOnce({ galaxy: taken.galaxy, system: taken.system, position: taken.position })
        .mockReturnValueOnce({ galaxy: taken.galaxy, system: taken.system, position: taken.position })
        .mockReturnValueOnce({ galaxy: taken.galaxy, system: taken.system, position: taken.position })
        .mockReturnValue(free);

      const user = newUser();
      const result = await auth.register(user);

      expect(pick).toHaveBeenCalledTimes(4);
      const planets = await database.planet.findMany({ where: { userId: result.user.id } });
      expect(planets).toHaveLength(1);
      expect(planets[0]).toMatchObject(free);
    });

    it('abandonne après le nombre maximal de tentatives : 503, aucun compte créé', async () => {
      const owner = newUser();
      const occupied = await auth.register(owner);
      const taken = await database.planet.findFirstOrThrow({ where: { userId: occupied.user.id } });

      const pick = jest
        .spyOn(auth as any, 'pickStarterCoordinates')
        .mockReturnValue({ galaxy: taken.galaxy, system: taken.system, position: taken.position });

      const user = newUser();
      await expect(auth.register(user)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(pick).toHaveBeenCalledTimes(10);
      expect(await database.user.findUnique({ where: { username: user.username } })).toBeNull();
      expect(await database.user.count({ where: { email: user.email } })).toBe(0);
    });
  });

  describe('concurrence', () => {
    it('20 inscriptions simultanées sur un petit univers : chaque compte a exactement une planète', async () => {
      // Environ 200 positions libres seulement, pour provoquer de vraies collisions
      const candidates = Array.from({ length: 200 }, (_, i) => ({
        galaxy: 9,
        system: 300 + Math.floor(i / 15),
        position: (i % 15) + 1,
      }));
      const occupied = await database.planet.findMany({
        where: { galaxy: 9, system: { gte: 300, lt: 314 } },
        select: { galaxy: true, system: true, position: true },
      });
      const taken = new Set(occupied.map((p) => `${p.system}:${p.position}`));
      const pool = candidates.filter((c) => !taken.has(`${c.system}:${c.position}`));
      jest
        .spyOn(auth as any, 'pickStarterCoordinates')
        .mockImplementation(() => pool[Math.floor(Math.random() * pool.length)]);

      const users = Array.from({ length: 20 }, newUser);
      const results = await Promise.allSettled(users.map((u) => auth.register(u)));

      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);

      const rows = await database.user.findMany({
        where: { username: { in: users.map((u) => u.username) } },
        include: { planets: true, sessions: true },
      });
      expect(rows).toHaveLength(20);
      rows.forEach((row) => {
        expect(row.planets).toHaveLength(1); // jamais de compte sans planète
        expect(row.sessions).toHaveLength(1);
      });
      const coords = rows.map((r) => `${r.planets[0].galaxy}:${r.planets[0].system}:${r.planets[0].position}`);
      expect(new Set(coords).size).toBe(20); // positions toutes distinctes
    });

    it('même nom d\'utilisateur en parallèle : un succès, les autres en 409 (jamais 500)', async () => {
      const base = newUser();
      const attempts = Array.from({ length: 6 }, (_, i) => ({
        username: base.username,
        email: `race${i}_${base.email}`,
        password: base.password,
      }));

      const results = await Promise.allSettled(attempts.map((a) => auth.register(a)));

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .forEach((r) => expect(r.reason).toBeInstanceOf(ConflictException));
      expect(await database.user.count({ where: { username: base.username } })).toBe(1);
    });

    it('même email en parallèle : un succès, les autres en 409', async () => {
      const base = newUser();
      const attempts = Array.from({ length: 6 }, (_, i) => {
        const u = { username: `${base.username}_${i}`.slice(0, 20), email: base.email, password: base.password };
        created.push(u.username);
        return u;
      });

      const results = await Promise.allSettled(attempts.map((a) => auth.register(a)));

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .forEach((r) => expect(r.reason).toBeInstanceOf(ConflictException));
      expect(await database.user.count({ where: { email: base.email } })).toBe(1);
    });

    it('via HTTP : doublon séquentiel en 409 avec message explicite', async () => {
      const user = newUser();
      await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

      const sameName = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, email: `autre_${user.email}` });
      expect(sameName.status).toBe(409);
      expect(String(sameName.body.message)).toMatch(/nom d'utilisateur/);

      const other = newUser();
      const sameEmail = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...other, email: user.email });
      expect(sameEmail.status).toBe(409);
      expect(String(sameEmail.body.message)).toMatch(/email/i);
    });
  });
});
