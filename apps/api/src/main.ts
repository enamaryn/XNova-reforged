import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initSentry } from './monitoring/sentry';

async function bootstrap() {
  // Initialiser Sentry
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  if (sentryDsn) {
    initSentry(sentryDsn, environment);
  }

  const app = await NestFactory.create(AppModule);

  // Configuration CORS
  const webOrigins = (process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd && webOrigins.length > 0 ? webOrigins : true,
    credentials: true,
  });

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non déclarées dans le DTO
      forbidNonWhitelisted: true, // Rejette les requêtes avec propriétés inconnues
      transform: true, // Transforme automatiquement les types
    }),
  );

  // Récupération du port depuis la config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT') || 3001;
  const swaggerFlag = configService.get<string>('SWAGGER_ENABLED');
  const swaggerEnabled = swaggerFlag ? swaggerFlag === 'true' : !isProd;
  const swaggerPath = configService.get<string>('SWAGGER_PATH') || 'api/docs';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('XNova Reforged API')
      .setDescription('Documentation API pour XNova Reforged')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document);
  }

  await app.listen(port);
  console.log(`🚀 API NestJS démarrée sur http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`📘 Swagger disponible sur http://localhost:${port}/${swaggerPath}`);
  }
}

bootstrap();
