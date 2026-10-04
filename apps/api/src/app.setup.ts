import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolveAllowedOrigins } from './config/env.validation';
import { securityHeaders } from './common/security/security-headers';

/** Configuration HTTP commune à main.ts et aux tests d'intégration (SEC-04). */
export function configureApp(app: INestApplication, options: { swagger?: boolean } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const express = app as NestExpressApplication;

  // Derrière un proxy, `TRUST_PROXY` (ex. 1) permet de lire la vraie IP pour la limitation de débit
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && typeof express.set === 'function') {
    express.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  app.use(securityHeaders({ production: isProd, swagger: !!options.swagger }));

  // Production : liste d'origines obligatoire (validée au démarrage) ; jamais ouvert
  app.enableCors({
    origin: resolveAllowedOrigins(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non déclarées dans le DTO
      forbidNonWhitelisted: true, // Rejette les requêtes avec propriétés inconnues
      transform: true, // Transforme automatiquement les types
    }),
  );
}
