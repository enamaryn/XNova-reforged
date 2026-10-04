import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import { mkdirSync, rmdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { DatabaseService } from '../../src/database/database.service';

export interface IntegrationApp {
  app: INestApplication;
  database: DatabaseService;
}

let userCounter = 0;

/**
 * Utilisateur de test unique : aléa cryptographique + compteur, donc aucune collision possible
 * même pour plusieurs comptes créés dans la même milliseconde (QUAL-02).
 */
export function buildTestUser() {
  userCounter += 1;
  const unique = `${randomBytes(4).toString('hex')}${userCounter.toString(36)}`;
  return {
    username: `it_${unique}`,
    email: `itest_${unique}@example.test`,
    password: 'Test1234!',
  };
}

export async function createIntegrationApp(): Promise<IntegrationApp> {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  // Les suites créent de nombreux comptes depuis la même IP : limites très hautes sauf test dédié
  process.env.RATE_LIMIT_LOGIN_MAX = process.env.RATE_LIMIT_LOGIN_MAX || '100000';
  process.env.RATE_LIMIT_REGISTER_MAX = process.env.RATE_LIMIT_REGISTER_MAX || '100000';
  process.env.RATE_LIMIT_ACCOUNT_MAX = process.env.RATE_LIMIT_ACCOUNT_MAX || '100000';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  // Les tâches planifiées de l'application sont arrêtées : les suites appellent elles-mêmes les services
  // de résolution (arrivées de flottes, files, production). Un cron concurrent prendrait en charge un
  // événement pendant qu'une suite attend le sien, qui rendrait alors la main avant la validation de
  // l'autre transaction (assertions lues trop tôt) et croiserait les suppressions de fin de suite.
  app.get(SchedulerRegistry)
    .getCronJobs()
    .forEach((job) => job.stop());

  const database = app.get(DatabaseService);
  return { app, database };
}

export async function registerAndLogin(app: INestApplication, testUser: ReturnType<typeof buildTestUser>) {
  const server = app.getHttpServer();
  await request(server).post('/auth/register').send(testUser).expect(201);
  const loginResponse = await request(server)
    .post('/auth/login')
    .send({ identifier: testUser.username, password: testUser.password })
    .expect(200);

  // Les ressources sont du Float alimenté par le cron de production (toutes les minutes) pour les
  // joueurs actifs : un compte « inactif depuis 30 jours » est ignoré par le cron, ce qui garde les
  // assertions exactes sur les stocks stables (sinon échec aléatoire quand le cron passe en cours de test).
  await app
    .get(DatabaseService)
    .user.update({ where: { username: testUser.username }, data: { lastActive: DORMANT_SINCE() } });

  return {
    accessToken: loginResponse.body?.tokens?.accessToken,
  };
}

/** Date de dernière activité qui exclut le compte de la production périodique des ressources. */
export const DORMANT_SINCE = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

/**
 * Les crons de l'application tournent pendant les tests : une suppression en cascade peut croiser
 * leurs verrous de lignes (deadlock PostgreSQL 40P01, Prisma P2034). On la rejoue quelques fois.
 */
export async function retryOnDeadlock<T>(operation: () => Promise<T>, attempts = 6): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const text = String((error as { message?: string; code?: string })?.message ?? error);
      const code = (error as { code?: string })?.code;
      const isDeadlock = code === 'P2034' || text.includes('40P01') || text.includes('deadlock detected');
      if (!isDeadlock || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}

export async function deleteUsersByIds(database: DatabaseService, ids: string[]) {
  if (ids.length === 0) return;
  await retryOnDeadlock(() => database.user.deleteMany({ where: { id: { in: ids } } }));
}

export async function cleanupTestUser(database: DatabaseService, username: string) {
  const existing = await database.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    await retryOnDeadlock(() => database.user.deleteMany({ where: { id: existing.id } }));
  }
}

/**
 * Verrou entre suites : les suites tournent en parallèle sur la même base ; celles qui modifient un état
 * global (configuration SMTP dans `GameConfig`) doivent s'exécuter l'une après l'autre.
 * Verrou par répertoire (création atomique), repris s'il date de plus de deux minutes (suite interrompue).
 */
export async function acquireGlobalLock(name: string): Promise<() => void> {
  const dir = join(tmpdir(), `xnova-itest-lock-${name}`);
  const deadline = Date.now() + 180_000;
  for (;;) {
    try {
      mkdirSync(dir);
      return () => {
        try {
          rmdirSync(dir);
        } catch {
          // déjà libéré
        }
      };
    } catch {
      try {
        if (Date.now() - statSync(dir).mtimeMs > 120_000) rmdirSync(dir);
      } catch {
        // libéré entre-temps
      }
      if (Date.now() > deadline) throw new Error(`Verrou ${name} non obtenu`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
