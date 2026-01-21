# 🔌 API Reference — XNova Reforged

Ce document recense les principaux endpoints exposés par `apps/api`, avec la méthode HTTP, les chemins et leur objectif. Toutes les routes protégées utilisent `JwtAuthGuard` (sauf `/auth/*` et `/galaxy` qui précise).

## Authentification (`/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/register` | Inscription d’un nouveau joueur (username/email/password). Retourne tokens JWT. |
| POST | `/auth/login` | Connexion | 
| POST | `/auth/refresh` | Rafraîchit le token d’accès via `refreshToken`. |
| POST | `/auth/logout` | Déconnexion (JWT stateless). |
| GET | `/auth/me` | Infos du joueur courants (planètes, ressources) — JWT requis. |

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
| POST | `/fleet/send` | Envoi de flotte (`SendFleetDto`). |
| DELETE | `/fleet/:fleetId` | Rappel d’une flotte avant arrivée. |

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
| GET | `/admin/config` | Valeurs courantes `ServerConfigValues`. |
| PUT | `/admin/config` | Met à jour les multiplicateurs + gameSpeed. |
| PUT | `/admin/roles` | Changer le rôle d’un joueur (SUPER_ADMIN). |
| PUT | `/admin/boost-development` | Boost d’une progression (SUPER_ADMIN). |
| PUT | `/admin/ban` | Bannir un joueur. |
| PUT | `/admin/unban` | Débannir. |
| GET | `/admin/audit` | Logs d’administration. |
| GET | `/admin/ban-logs` | Historique des sanctions. |

## Statistiques (`/statistics`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/statistics` | Classements personnels + top joueurs/alliances. |

⚠️ Toutes les routes ci-dessus (hors `/auth/*` et `/galaxy/*`) sont sécurisées par JWT. Utiliser le token `Authorization: Bearer <accessToken>` renvoyé par `/auth/login`.
