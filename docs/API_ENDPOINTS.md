# 🔌 API Reference — XNova Reforged

Ce document recense les principaux endpoints exposés par `apps/api`, avec la méthode HTTP, les chemins et leur objectif. Toutes les routes protégées utilisent `JwtAuthGuard` (sauf `/auth/*` et `/galaxy` qui précise).

## Authentification (`/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/register` | Inscription d’un nouveau joueur (username/email/password). Retourne tokens JWT. |
| POST | `/auth/login` | Connexion | 
| POST | `/auth/refresh` | Rafraîchit le token d’accès via `refreshToken`. |
| POST | `/auth/logout` | Déconnexion (JWT stateless). |
| GET | `/auth/me` | Infos du joueur courants (planètes, langue `locale`) — JWT requis. |
| PUT | `/auth/locale` | Enregistre la langue du joueur (`fr`, `en`, `es`, `de`, `it`) : emails et textes — JWT requis. |

### Langue (`X-Locale`)

L’interface envoie l’en-tête `X-Locale` (`fr`, `en`, `es`, `de`, `it`) à chaque appel : l’API localise alors les noms et descriptions du jeu, les libellés d’effets d’amélioration et les prérequis ; absent ou inconnu, les textes restent en français. `GET /setup/status` (public) renvoie `{ setupRequired, language }` — `language` est la langue du serveur choisie à l’installation (`PUT /setup/language`, code d’installation requis, ou `PUT /admin/config` avec `language`).

## Planètes & ressources (`/planets`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/planets/:planetId` | Détails planète (coordonnées, bâtiments, production). |
| GET | `/planets/:planetId/resources` | Production en temps réel + ressources actuelles. |
| GET | `/planets/:planetId/buildings` | Liste bâtiments disponibles avec coûts/niveaux + état de la file (`BuildingService`). |
| POST | `/planets/:planetId/build` | Démarre une construction (`StartBuildDto`). |
| GET | `/planets/:planetId/build-queue` | Récupère la file de construction active. |
| DELETE | `/planets/:planetId/build-queue/:queueId` | Annule une construction et rembourse les ressources. |
| POST | `/planets/colonize` | Coloniser un nouveau système (`ColonizePlanetDto`). |
| PUT | `/planets/:planetId` | Renommer la planète (`RenamePlanetDto`). |
| GET | `/planets/scan/:planetId` | Scan rapide d’une planète distante (infos publiques). |

## Recherche & technologies

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/technologies?planetId=...` | Technologies disponibles à partir d’une planète. |
| POST | `/research` | Démarre une recherche (`StartResearchDto`). |
| GET | `/research-queue` | File utilisateur (actuelle). |
| DELETE | `/research-queue/:queueId` | Annule une recherche. |

## Flottes (`/fleet`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/fleet/available/:planetId` | Vaisseaux disponibles sur la planète. |
| GET | `/fleet/active` | Missions en cours pour l’utilisateur. |
| POST | `/fleet/send` | Envoi de flotte (`SendFleetDto`) ; `toMoon: true` vise la lune des coordonnées (transport, déploiement, espionnage, attaque) ; une flotte partie d'une lune y revient. |
| DELETE | `/fleet/:fleetId` | Rappel d’une flotte avant arrivée. |

## Expéditions

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/fleet/send` | Avec `mission: 5` (maintien de position) : `holdHours` (1 à 32) obligatoire, cible = planète ou lune (`toMoon`) d'un membre de la même alliance ; carburant de maintien payé d'avance (réponse : `holdFuel`). Le rappel (`DELETE /fleet/:id`) fonctionne aussi pendant le maintien. |
| POST | `/fleet/send` | Avec `mission: 15` et `toPosition: 16` (position réservée aux expéditions) : technologie Expédition (124) requise, expéditions simultanées limitées à la racine entière du niveau. |
| GET | `/expedition-reports` | 50 derniers rapports d'expédition du joueur. |
| GET | `/expedition-reports/:reportId` | Un rapport (404 si ce n'est pas le sien). |

## Missiles interplanétaires (`/missiles`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/missiles/:planetId` | Silo (niveau, capacité, stock, fabrications), portée, frappes lancées et subies (20 dernières). |
| POST | `/missiles/launch` | Lance des missiles interplanétaires (`LaunchMissilesDto` : `planetId`, `toGalaxy`, `toSystem`, `toPosition`, `amount`, `primaryTarget?`). Même galaxie, portée 5 × niveau de Réacteur à impulsion − 1 systèmes. |

Les missiles se fabriquent par `/defense/build` (502, 503) dans la limite de 10 par niveau de silo. La résolution est faite par la tâche planifiée `missiles` (toutes les 10 s).

## Officiers (`/officers`)

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/officers` | Les cinq officiers (`intendant`, `admiral`, `engineer`, `geologist`, `technocrat`) avec bonus, état d'embauche, prix et bonus cumulés actifs. |
| POST | `/officers/:type/hire` | Embauche définitive (`planetId` : planète du joueur qui paie 500 000 deutérium). 404 type inconnu ou planète étrangère, 409 déjà embauché, 400 deutérium insuffisant. Règle d'abord la production de toutes les planètes avec les anciens bonus. |

## Lunes (`/moons`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/moons/:moonId` | Phalange (niveau, portée, coût), porte de saut (niveau, recharge, autres lunes équipées). |
| POST | `/moons/:moonId/phalanx` | Balayage d'une planète d'un autre joueur à portée (`galaxy`, `system`, `position`) : mouvements de flotte (mission, sens, trajet, heure, nombre de vaisseaux) ; coûte 5 000 deutérium de la lune. |
| POST | `/moons/:moonId/jump` | Saut instantané de vaisseaux (`toMoonId`, `ships`) vers une autre lune du joueur équipée d'une porte ; recharge des deux portes. |

## Recherche : réseau intergalactique

`GET /technologies?planetId=…` renvoie en plus `labNetwork` : `{ networkLevel, ownLab, effectiveLab, linked }`. Le temps de recherche (annoncé et réel) utilise `effectiveLab` = laboratoire de la planète + les `networkLevel` meilleurs laboratoires des autres planètes du joueur (lunes exclues).

## Chantier spatial (`/shipyard`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/shipyard?planetId=...` | Liste des constructions possibles. |
| POST | `/shipyard/build` | Construire un ou plusieurs vaisseaux (`BuildShipDto`). |
| GET | `/shipyard/queue?planetId=...` | File d’attente actuelle. |
| DELETE | `/shipyard/queue/:queueId` | Annulation d’une construction. |

## Galaxie (`/galaxy`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/galaxy/:galaxy/:system` | Retourne les 15 positions d’un système + infos (propriétaires, lunes). |

## Rapports & combats (`/reports`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/reports` | Liste des rapports du joueur. |
| GET | `/reports/:reportId` | Détail d’un rapport de combat. |

## Messagerie (`/messages`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/messages/inbox` | Inbox filtrée (non lus en tête). |
| GET | `/messages/:id` | Lecture d’un message. |
| POST | `/messages/send` | Envoi de message à un autre joueur (`SendMessageDto`). |
| DELETE | `/messages/:id` | Suppression d’un message. |

## Alliances (`/alliances`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/alliances/me` | Info alliance du joueur courant. |
| GET | `/alliances/:id` | Détail et liste des membres. |
| POST | `/alliances/create` | Création d’une alliance (`CreateAllianceDto`). |
| POST | `/alliances/:id/invite` | Invitation d’un joueur (`InviteAllianceDto`). |
| POST | `/alliances/:id/join` | Rejoindre une alliance. |
| DELETE | `/alliances/:id/leave` | Quitter son alliance. |

## Administration (`/admin`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/overview` | Synthèse serveur (obligatoire modérateur+). |
| GET | `/admin/players?search=...&page=1` | Liste paginée (25 joueurs), recherche par pseudo, états et classement (modérateur+). |
| GET | `/admin/players/:id` | Fiche : niveaux des bâtiments et technologies, ressources actuelles par planète (modérateur+). |
| PUT | `/admin/players/:id/email` | Corrige l’email, révoque les sessions et envoie une vérification obligatoire (administrateur+ ; seul le super admin peut modifier un super admin). |
| GET | `/admin/config` | Valeurs courantes `ServerConfigValues`. |
| PUT | `/admin/config` | Met à jour les multiplicateurs + gameSpeed. |
| PUT | `/admin/roles` | Changer le rôle d’un joueur (SUPER_ADMIN). |
| PUT | `/admin/boost-development` | Boost d’une progression (SUPER_ADMIN). |
| PUT | `/admin/ban` | Bannir un joueur. |
| PUT | `/admin/unban` | Débannir. |
| GET | `/admin/audit` | Logs d’administration. |
| GET | `/admin/ban-logs` | Historique des sanctions. |

## Supervision (`/admin/supervision`, `/monitoring`, `/setup`)

| Route | Accès | Rôle |
|---|---|---|
| `GET /admin/supervision/overview` | ADMIN, SUPER_ADMIN | santé, statistiques, disponibilité (`uptime` 24 h/7 j/30 j), configuration (sans secret) |
| `GET /admin/supervision/incidents` | ADMIN, SUPER_ADMIN | liste paginée côté serveur (`period`, `level`, `source`, `status`, `q`, `sort`, `page`, `pageSize` ≤ 50) |
| `GET /admin/supervision/incidents/:id` | ADMIN, SUPER_ADMIN | détail (trace et contexte filtrés) |
| `PATCH /admin/supervision/incidents/:id/status` | SUPER_ADMIN | `new`/`seen`/`resolved`/`ignored` (audit) |
| `GET /admin/supervision/export?format=json\|csv` | ADMIN, SUPER_ADMIN | export filtré (5 000 lignes max) |
| `GET/PUT /admin/supervision/config` | lecture ADMIN, écriture SUPER_ADMIN | paramètres locaux et Sentry (DSN chiffrés, jamais renvoyés) |
| `DELETE /admin/supervision/sentry` | SUPER_ADMIN | supprime la configuration Sentry |
| `POST /admin/supervision/sentry/test` | SUPER_ADMIN | test Sentry, résultat conservé |
| `POST /admin/supervision/purge` | SUPER_ADMIN | purge (`confirm: true` obligatoire) |
| `POST /monitoring/client-errors` | public, limité par adresse | erreurs du navigateur (schéma strict) |
| `GET /monitoring/public-config` | public | DSN navigateur seulement si Sentry est actif |
| `PUT /setup/supervision`, `POST /setup/sentry/test` | code d'installation | étape « Supervision » de l'assistant |

## Statistiques (`/statistics`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/statistics` | Classements personnels + top joueurs/alliances. |

⚠️ Toutes les routes ci-dessus (hors `/auth/*` et `/galaxy/*`) sont sécurisées par JWT. Utiliser le token `Authorization: Bearer <accessToken>` renvoyé par `/auth/login`.


## Progression

- `GET /progression` — niveau du commandant, développement et puissance du joueur.
- `GET /progression/onboarding` — guide des premiers pas : 11 objectifs ordonnés (`solar_plant`, `metal_mine`, `crystal_mine`, `deuterium_mine`, `energy_balance`, `research_lab`, `first_research`, `shipyard`, `first_ship`, `first_mission`, `mission_report`) avec `status` (`done`, `current`, `upcoming`), la page cible (`route`), `completed`, `total`, `currentStepId`, `finished`. Authentifié, lecture seule, propre au joueur courant.
