import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
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

  await app.listen(port);
  console.log(`🚀 API NestJS démarrée sur http://localhost:${port}`);
}

bootstrap();
