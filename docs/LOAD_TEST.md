# OPS-03 — Validation de charge : 200 joueurs simultanés à vitesse ×50

Ce document fixe les **seuils avant exécution** (critère de sortie OPS-03). Les résultats sont ajoutés dans la section « Résultats » après la campagne, sans modifier les seuils.

## Scénario

- 200 joueurs simulés, inscription puis connexion, une connexion WebSocket chacun (`auth.token`).
- Profil de jeu `SPEED_PROFILES.reference` (×50, `packages/game-config/src/speed-profiles.ts`).
- Montée en charge ~60 s, palier stable ~10 min, arrêt progressif.
- Chaque joueur boucle avec temps de réflexion (1–4 s) : `/auth/me`, ressources, bâtiments, lancement/annulation de construction, file de recherche, galaxie, statistiques, messages, onboarding, envois de flotte occasionnels.
- Générateur : `scripts/load/load-test.mjs` (`npm run load`). Rapport JSON dans `docs/audits/`.

## Seuils (fixés avant exécution)

| Indicateur | Seuil |
| --- | --- |
| Lectures (GET) | p95 ≤ 500 ms, p99 ≤ 1 500 ms |
| Écritures (POST/PUT/DELETE) | p95 ≤ 1 000 ms, p99 ≤ 2 500 ms |
| Inscription / connexion | p95 ≤ 3 000 ms |
| Erreurs 5xx + erreurs réseau | ≤ 0,5 % des requêtes |
| WebSocket | ≥ 99 % des 200 connexions établies et tenues sur le palier |
| Processus API | aucun crash ni redémarrage |
| `/health` | répond 200 pendant toute la fenêtre |

Les réponses 4xx métier attendues (ressources insuffisantes, file pleine) ne sont pas des erreurs ; les 429 sont comptés à part et doivent rester à 0 avec les limites relevées documentées.

## Conditions d'exécution et biais

- Générateur et serveur partagent la même machine (4 cœurs, 16 Go) : biais conservateur pour les latences.
- API de production (`node apps/api/dist/main`), PostgreSQL et Redis locaux, base dédiée migrée.
- Limites de débit relevées pour que le générateur (une seule IP) ne déclenche pas le rate limiting ; sans quoi il testerait le limiteur, pas la charge.
- L'uptime sur le serveur de production reste une action du propriétaire.

## Résultats

_À compléter après exécution._
