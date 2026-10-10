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

## Résultats — 10 octobre 2026 : **seuils respectés**

Rapport brut : [`docs/audits/load-test-2026-10-10.json`](audits/load-test-2026-10-10.json) ; diffusion WebSocket au repos : [`docs/audits/load-test-ws-idle-2026-10-10.json`](audits/load-test-ws-idle-2026-10-10.json).

**Matériel et configuration.** 4 cœurs Xeon 2,8 GHz, 16 Go de RAM, Node 22.22, PostgreSQL 16.14 et Redis locaux, API de production (`node dist/main.js`), base vierge migrée (`prisma migrate deploy`), `setup.completedAt` posé, `GAME_SPEED=FLEET_SPEED=50`, multiplicateurs 1, base 20/10/0, `EMAIL_VERIFICATION_REQUIRED=false`, limites de débit d'inscription/connexion/compte relevées à 100 000. Générateur sur la même machine.

**Données.** 200 comptes créés pendant la montée (60 s), palier de 604 s, puis 70 s d'inactivité WebSocket. 49515 requêtes (≈ 74.6 req/s en moyenne), dont 1 468 constructions acceptées et 1 412 messages envoyés ; base finale de 11 Mo.

| Groupe | Requêtes | p50 (ms) | p95 (ms) | p99 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Lectures | 41245 | 11 | 46 | 97 |
| Écritures | 7870 | 11 | 35 | 121 |
| Inscription + connexion | 400 | 117 | 143 | 161 |

| Indicateur | Mesure | Seuil | Verdict |
| --- | --- | --- | --- |
| Erreurs 5xx + réseau | 0 sur 49515 | ≤ 0,5 % | OK |
| 429 (limites relevées) | 0 | 0 | OK |
| WebSocket tenues à la fin | 200/200, 0 coupure | ≥ 99 % | OK |
| `/health` | 146 contrôles, 0 échec | 0 échec | OK |
| Crash / redémarrage API | aucun ; RSS max 257 Mo | aucun | OK |

**Par route** (ms).

| Route | Requêtes | p50 | p95 | p99 | max | Statuts |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `GET /planets/:id/resources` | 9598 | 13 | 25 | 83 | 736 | 200×9598 |
| `GET /auth/me` | 7255 | 8 | 16 | 49 | 647 | 200×7255 |
| `GET /planets/:id/buildings` | 4898 | 18 | 33 | 137 | 798 | 200×4898 |
| `POST /planets/:id/build` | 4893 | 12 | 38 | 182 | 978 | 201×1468, 400×3425 |
| `GET /galaxy/:g/:s` | 3716 | 8 | 17 | 89 | 727 | 200×3716 |
| `GET /planets/:id/build-queue` | 3279 | 9 | 19 | 240 | 707 | 200×3279 |
| `GET /research-queue` | 2874 | 6 | 15 | 117 | 675 | 200×2874 |
| `GET /statistics` | 2365 | 48 | 71 | 190 | 799 | 200×2365 |
| `GET /messages/inbox` | 1962 | 7 | 15 | 83 | 659 | 200×1962 |
| `GET /technologies` | 1918 | 10 | 20 | 103 | 711 | 200×1918 |
| `GET /progression/onboarding` | 1433 | 13 | 26 | 111 | 467 | 200×1433 |
| `POST /messages/send` | 1412 | 10 | 21 | 89 | 925 | 201×1412 |
| `GET /shipyard` | 984 | 18 | 32 | 62 | 703 | 200×984 |
| `GET /fleet/active` | 963 | 7 | 14 | 130 | 727 | 200×963 |
| `POST /research` | 804 | 10 | 20 | 37 | 144 | 400×804 |
| `POST /fleet/send` | 485 | 10 | 23 | 836 | 866 | 400×485 |
| `POST /shipyard/build` | 276 | 8 | 15 | 25 | 31 | 400×276 |
| `POST /auth/register` | 200 | 119 | 142 | 166 | 230 | 201×200 |
| `POST /auth/login` | 200 | 115 | 143 | 158 | 274 | 200×200 |

**WebSocket.** 200/200 connexions établies (événement `connected`, donc après l'authentification du gateway, espace de noms `/game`) et abonnées à leur planète. Au repos, le cron minute diffuse `resources:updated` à chacun des 200 sockets (200 événements par passage, 400 en 130 s dans l'essai dédié). Le cron de ressources traite ~640 planètes en 420–510 ms.

### Lecture et limites

- Les latences sont très inférieures aux seuils (p95 lecture 46 ms pour 500 ms visés), même avec générateur et serveur sur la même machine. Les maxima isolés (≤ 1 s, un par route environ) n'ont pas été analysés ; ils restent sous les seuils p99.
- Les 400 renvoyés par `POST /planets/:id/build` (3 425) sont des refus métier attendus (file occupée, ressources insuffisantes) ; `POST /research`, `/shipyard/build` et `/fleet/send` sont tous refusés (prérequis ou ressources absents après quelques minutes de jeu) : **ces écritures n'ont exercé que la validation et les refus, pas leur chemin de succès** — les verrous économiques restent couverts par les tests d'intégration, pas par cette campagne.
- Le scénario ne simule pas la fin de constructions/missions à ×50 sous charge, ni les rendus côté navigateur. 200 joueurs « actifs » avec 1–4 s de réflexion correspondent à une charge supérieure à des joueurs réels.
- Constaté : tant qu'un joueur appelle l'API, son rafraîchissement par requête devance le cron et le push `resources:updated` n'est pas émis pour lui (1 992 événements reçus pour 200 joueurs sur ~11 minutes, soit moins que les ~2 200 passages possibles). Sans conséquence fonctionnelle (le client lit les ressources par HTTP), à garder en tête si le client doit se fier au push.
- Constaté : sur le premier essai, le harnais se connectait par erreur à l'espace de noms `/` : 200 « connexions » sans authentification ni événements. Corrigé (`/game` + attente de `connected`) avant les résultats ci-dessus.

### Sauvegarde et restauration sur la base chargée

`scripts/backup-db.sh` (0,24 s, archive 216 Ko vérifiée) puis `scripts/restore-db.sh --yes` vers une base neuve (0,40 s). Comptages identiques entre source et copie restaurée : 201 utilisateurs, 400 planètes, 1 412 messages, 1 468 files de construction, 400 sessions, somme des ressources 216 556. Données synthétiques ; ce n'est pas une sauvegarde de production.

### Couverture

Tests unitaires de l'API (`jest --coverage`, 83 tests) : 52,8 % des instructions, 48,2 % des branches, 43,5 % des fonctions — uniquement les fichiers chargés par les unitaires ; la couverture de l'intégration n'est pas mesurée. Aucun seuil n'avait été fixé : mesure à titre indicatif.

### Reste ouvert pour clore OPS-03

Lighthouse (pages publiques), uptime en production (action du propriétaire, après mise à jour), test d'intégration de refus d'accès interjoueur, mesure sur le serveur du propriétaire avec le profil ×50, chemin de succès des écritures sous charge (recherche, chantier, flotte) avec des comptes préalablement dotés.

## Reproduire

```bash
# API de production démarrée sur une base dédiée (voir « Conditions d'exécution »)
PLAYERS=200 RAMP_S=60 HOLD_S=600 IDLE_S=70 OUT=docs/audits/load-test-AAAA-MM-JJ.json npm run load
```
