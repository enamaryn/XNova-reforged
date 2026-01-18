import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

describe('API integration - Auth & Planetes', () => {
  let app: INestApplication;
  let database: DatabaseService;
  // Utiliser un identifiant court pour respecter la limite de 20 caractères
  const unique = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);
  const testUser = {
    username: `it_${unique}`,
    email: `itest_${unique}@example.test`,
    password: 'Test1234!',
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    if (database) {
      const existing = await database.user.findUnique({
        where: { username: testUser.username },
        select: { id: true },
      });
      if (existing) {
        await database.user.delete({ where: { id: existing.id } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('inscrit, connecte et recupere la planete', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(registerResponse.body?.tokens?.accessToken).toBeTruthy();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: testUser.username, password: testUser.password })
      .expect(200);

    const accessToken = loginResponse.body?.tokens?.accessToken;
    expect(accessToken).toBeTruthy();

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body?.username).toBe(testUser.username);
    expect(meResponse.body?.planets?.length).toBeGreaterThan(0);

    const planetId = meResponse.body.planets[0].id;
    const planetResponse = await request(app.getHttpServer())
      .get(`/planets/${planetId}/resources`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(planetResponse.body?.planetId).toBe(planetId);
    expect(planetResponse.body?.resources).toBeDefined();
  });
});
