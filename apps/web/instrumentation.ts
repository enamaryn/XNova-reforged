import * as Sentry from '@sentry/nextjs';

/**
 * Initialisation de Sentry côté serveur Next (Node.js et edge). Chargé une fois au démarrage.
 * Sans DSN (variable d'environnement), l'intégration reste inactive sans provoquer d'erreur.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/** Erreurs des requêtes serveur imbriquées (composants serveur, routes, actions). */
export const onRequestError = Sentry.captureRequestError;
