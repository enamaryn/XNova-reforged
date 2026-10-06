import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
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

/**
 * Les inscriptions sont fermées tant que l'installation du serveur n'est pas terminée (SETUP-01) : les suites
 * marquent l'installation terminée avant de démarrer l'application (hors suite dédiée au parcours).
 */
async function markSetupCompletedForTests() {
  const client = new PrismaClient();
  try {
    await client.gameConfig.upsert({
      where: { key: 'setup.completedAt' },
      create: { key: 'setup.completedAt', value: new Date().toISOString() },
      update: {},
    });
  } finally {
    await client.$disconnect();
  }
}

export async function createIntegrationApp(options: { setupCompleted?: boolean } = {}): Promise<IntegrationApp> {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  // Les suites créent de nombreux comptes depuis la même IP : limites très hautes sauf test dédié
  process.env.RATE_LIMIT_LOGIN_MAX = process.env.RATE_LIMIT_LOGIN_MAX || '100000';
  process.env.RATE_LIMIT_REGISTER_MAX = process.env.RATE_LIMIT_REGISTER_MAX || '100000';
  process.env.RATE_LIMIT_ACCOUNT_MAX = process.env.RATE_LIMIT_ACCOUNT_MAX || '100000';
  // La confirmation d'adresse est obligatoire en production ; les suites créent des comptes sans SMTP.
  // La suite dédiée la réactive (scope01-email-required).
  process.env.EMAIL_VERIFICATION_REQUIRED = process.env.EMAIL_VERIFICATION_REQUIRED || 'false';

  if (options.setupCompleted !== false) await markSetupCompletedForTests();

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
 * Verrou par répertoire (création atomique) portant le PID du détenteur : repris si ce processus n'existe
 * plus (suite interrompue) ou si le verrou date de plus de deux minutes.
 */
export async function acquireGlobalLock(name: string): Promise<() => void> {
  const dir = join(tmpdir(), `xnova-itest-lock-${name}`);
  const pidFile = join(dir, 'pid');
  const deadline = Date.now() + 170_000;
  const isAlive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(pidFile, String(process.pid));
      return () => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // déjà libéré
        }
      };
    } catch {
      try {
        const holder = Number(readFileSync(pidFile, 'utf8'));
        const age = Date.now() - statSync(dir).mtimeMs;
        if ((Number.isInteger(holder) && holder > 0 && !isAlive(holder)) || age > 120_000) {
          rmSync(dir, { recursive: true, force: true });
          continue;
        }
      } catch {
        // verrou en cours de création ou libéré entre-temps
      }
      if (Date.now() > deadline) throw new Error(`Verrou ${name} non obtenu`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/**
 * Schéma PostgreSQL dédié à une suite : migrations appliquées dans un schéma neuf, supprimé en fin de suite.
 * Pour les états globaux à la base (installation du serveur) qui perturberaient les suites parallèles.
 * Modifie `process.env.DATABASE_URL` pour la suite (restauré par `restore`).
 */
export async function useIsolatedSchema(prefix: string) {
  const schema = `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const original = process.env.DATABASE_URL ?? '';
  const baseUrl = original.replace(/[?&]schema=[^&]*/, '');
  if (!baseUrl) throw new Error('DATABASE_URL requis');
  const url = `${baseUrl}?schema=${schema}`;
  process.env.DATABASE_URL = url;
  execSync('npx prisma migrate deploy --schema ../../packages/database/prisma/schema.prisma', {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  });
  return {
    schema,
    url,
    /** Supprime le schéma (via un client dédié) et restaure DATABASE_URL. */
    async drop() {
      const client = new PrismaClient({ datasources: { db: { url } } });
      try {
        await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await client.$disconnect();
        process.env.DATABASE_URL = original;
      }
    },
  };
}
