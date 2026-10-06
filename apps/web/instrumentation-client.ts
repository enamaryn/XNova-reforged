import * as Sentry from '@sentry/nextjs';

// DSN public fourni par variable d'environnement (NEXT_PUBLIC_SENTRY_DSN), jamais versionné.
// Sans DSN, le SDK reste inactif.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});

/** Suivi des navigations du routeur App Router. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
