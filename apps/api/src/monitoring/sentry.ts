import * as Sentry from '@sentry/node';

/**
 * Initialise Sentry (suivi d'erreurs) pour l'API. Le DSN vient exclusivement de la variable
 * d'environnement `SENTRY_DSN` (jamais versionné) ; sans DSN, rien n'est initialisé et aucun module
 * natif n'est chargé.
 */
export function initSentry(dsn: string, environment: string) {
  if (!dsn) {
    console.warn('DSN Sentry non configuré, suivi des erreurs désactivé');
    return;
  }

  const sampleRate = environment === 'production' ? 0.1 : 1.0;
  const integrations: Sentry.NodeOptions['integrations'] = [];
  const options: Sentry.NodeOptions = {
    dsn,
    environment,
    integrations,
    tracesSampleRate: sampleRate,
  };

  // Le profilage dépend d'un module natif : chargé seulement avec un DSN, et sa défaillance ne doit pas
  // empêcher l'API de démarrer.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nodeProfilingIntegration } = require('@sentry/profiling-node');
    integrations.push(nodeProfilingIntegration());
    // Sentry 11 : profilage continu, rattaché aux traces échantillonnées (remplace profilesSampleRate)
    options.profileSessionSampleRate = sampleRate;
    options.profileLifecycle = 'trace';
  } catch (error) {
    console.warn(`Profilage Sentry indisponible : ${(error as Error).message}`);
  }

  Sentry.init(options);
  console.log(`Sentry initialisé pour l'environnement : ${environment}`);
}
