import * as Sentry from '@sentry/node';
import { redactString, redactValue } from '../supervision/redact';

/** Nettoie un événement Sentry avant envoi : en-têtes, cookies, corps de requête, utilisateur et chaînes sensibles. */
export function scrubSentryEvent<T extends Record<string, any>>(event: T): T {
  const copy: Record<string, any> = event;
  if (copy.request) {
    delete copy.request.headers;
    delete copy.request.cookies;
    delete copy.request.data;
    delete copy.request.query_string;
  }
  if (copy.user) copy.user = { id: copy.user.id };
  if (typeof copy.message === 'string') copy.message = redactString(copy.message);
  if (copy.extra) copy.extra = redactValue(copy.extra);
  if (copy.contexts) copy.contexts = redactValue(copy.contexts);
  for (const value of copy.exception?.values ?? []) {
    if (typeof value.value === 'string') value.value = redactString(value.value);
  }
  return event;
}

/**
 * Initialise Sentry (suivi d'erreurs) pour l'API. Le DSN vient exclusivement de la variable
 * d'environnement `SENTRY_DSN` (jamais versionné) ; sans DSN, rien n'est initialisé et aucun module
 * natif n'est chargé.
 */
export function initSentry(dsn: string, environment: string, sampleRateOverride?: number) {
  if (!dsn) {
    console.warn('DSN Sentry non configuré, suivi des erreurs désactivé');
    return;
  }

  const sampleRate = sampleRateOverride ?? (environment === 'production' ? 0.1 : 1.0);
  const integrations: Sentry.NodeOptions['integrations'] = [];
  const options: Sentry.NodeOptions = {
    dsn,
    environment,
    integrations,
    tracesSampleRate: sampleRate,
    // Aucune donnée sensible ne quitte le serveur, même en cas d'erreur dans le SDK
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
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
