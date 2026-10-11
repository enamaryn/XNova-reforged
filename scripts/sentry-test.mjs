#!/usr/bin/env node
// Vérifie le suivi d'erreurs Sentry avec le DSN de l'environnement : envoie un événement de test et attend
// la confirmation d'envoi. Le DSN n'est jamais affiché ni écrit ; sans DSN, la commande l'indique et échoue.
//
// Usage (sur le serveur, avec la même variable que le service) :
//   SENTRY_DSN='https://…' npm run sentry:test
// Lire le DSN du service sans le retaper :
//   sudo systemctl show xnova-api -p Environment --value | tr ' ' '\n' | grep '^SENTRY_DSN=' …
import { createRequire } from 'node:module';

const dsn = process.env.SENTRY_DSN?.trim();
if (!dsn) {
  console.error("SENTRY_DSN absent : le suivi d'erreurs est désactivé. Fournissez le DSN par variable d'environnement.");
  process.exit(1);
}
if (!/^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(dsn)) {
  console.error('SENTRY_DSN invalide : attendu https://<clé>@<hôte>/<projet>.');
  process.exit(1);
}

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const Sentry = require('@sentry/node');
// `flush` réussit même quand l'envoi est refusé : on relève donc le code de réponse HTTP réel de Sentry.
let statusCode;
let transportError;
Sentry.init({
  dsn,
  environment: `${process.env.SENTRY_ENV || process.env.NODE_ENV || 'development'}-test`,
  tracesSampleRate: 0,
  transport: (options) => {
    const transport = Sentry.makeNodeTransport(options);
    return {
      ...transport,
      send: async (envelope) => {
        try {
          const response = await transport.send(envelope);
          statusCode = response?.statusCode;
          return response;
        } catch (error) {
          transportError = error;
          throw error;
        }
      },
    };
  },
});

const eventId = Sentry.captureException(new Error('XNova Reforged : événement de test Sentry (npm run sentry:test)'));
await Sentry.flush(10_000);
if (statusCode !== 200) {
  const reason = transportError ? `erreur réseau : ${transportError.code ?? transportError.message}` : `réponse HTTP ${statusCode ?? 'aucune'}`;
  console.error(`Échec : Sentry n'a pas accepté l'événement (${reason}). Vérifiez le DSN et l'accès réseau sortant.`);
  process.exit(2);
}
console.log(`OK : événement de test accepté par Sentry (id ${eventId}). Vérifiez qu'il apparaît dans le projet Sentry.`);
