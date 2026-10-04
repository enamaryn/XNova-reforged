import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { initSentry } from './monitoring/sentry';

async function bootstrap() {
  // Initialiser Sentry
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  if (sentryDsn) {
    initSentry(sentryDsn, environment);
  }

  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';

  // Récupération du port depuis la config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT') || 3001;
  const swaggerFlag = configService.get<string>('SWAGGER_ENABLED');
  const swaggerEnabled = swaggerFlag ? swaggerFlag === 'true' : !isProd;
  const swaggerPath = configService.get<string>('SWAGGER_PATH') || 'api/docs';

  // CORS, en-têtes de sécurité, proxy de confiance et validation globale (SEC-04)
  configureApp(app, { swagger: swaggerEnabled });

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
