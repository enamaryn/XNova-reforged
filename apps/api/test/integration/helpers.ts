import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

export interface IntegrationApp {
  app: INestApplication;
  database: DatabaseService;
}

export function buildTestUser() {
  const unique = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);
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

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

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

  return {
    accessToken: loginResponse.body?.tokens?.accessToken,
  };
}

export async function cleanupTestUser(database: DatabaseService, username: string) {
  const existing = await database.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    await database.user.delete({ where: { id: existing.id } });
  }
}
