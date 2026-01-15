import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration CORS
  app.enableCors({
    origin: 'http://localhost:3000', // Frontend Next.js
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
