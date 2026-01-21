import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry(dsn: string, environment: string) {
  if (!dsn) {
    console.warn('DSN Sentry non configuré, suivi des erreurs désactivé');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
  });

  console.log(`Sentry initialisé pour l'environnement : ${environment}`);
}
