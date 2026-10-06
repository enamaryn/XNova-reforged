import * as Sentry from '@sentry/nextjs';

// DSN fourni exclusivement par variable d'environnement (jamais versionné). Sans DSN, le SDK reste
// inactif : aucune erreur, aucun envoi.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENV || process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
});
