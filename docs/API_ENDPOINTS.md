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

## Quêtes et succès

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/quests` | Quêtes du jour (3) et de la semaine (2) : `id`, `metric`, `target`, `progress`, `reward` (déjà multipliée par le niveau de commandant), `claimed`, `claimable` ; `resetsAt`, `periodKey`, `rewardMultiplier`. `pending` : quêtes terminées pendant une période passée et jamais réclamées (30 jours pour les journalières, 12 semaines pour les hebdomadaires) : `id`, `period`, `periodKey`, `metric`, `target`, `reward`, `expiresAt`. |
| POST | `/quests/:questId/claim` | Réclame une quête active et terminée (`planetId` du joueur : planète créditée). 400 non terminée, 404 quête inactive ou planète étrangère, 409 déjà réclamée pour la période (l'unicité `(joueur, quête, période)` tranche les demandes simultanées). `periodKey` (facultatif : `2026-10-13` ou `2026-W42`) réclame une quête d'une période passée encore dans la fenêtre : la progression est relue dans la fenêtre exacte de cette période ; 404 « n'est plus reclamable » au-delà de la fenêtre ou si la quête n'était pas tirée ; 400 clé invalide ; 409 déjà réclamée. |
| GET | `/achievements` | Les 34 succès par catégorie (`progress` plafonné à la cible, `unlocked`, `unlockedAt`), `percent` global et `newlyUnlocked` ; les nouveaux succès atteints sont enregistrés à cet appel et restent acquis. |

Les périodes sont en UTC : jour à minuit, semaine ISO du lundi au dimanche. La progression est dérivée des lignes déjà enregistrées par le jeu (constructions et recherches terminées, unités fabriquées, flottes, rapports de combat gagné, d'espionnage et d'expédition) depuis le début de la période ; rien n'est incrémenté à la main.
## Événements du monde (`/world-events`, `/admin/world-events`)

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/world-events/active` | Tout joueur connecté : événements en cours (`name` pour un événement personnalisé, `templateId` pour un modèle) et effets cumulés (`productionBonus`, `marketTaxReduction`). |
| GET | `/admin/world-events` | ADMIN et SUPER_ADMIN : événements en cours, 20 derniers terminés ou arrêtés, calendrier des modèles (`phase` : `active`, `reminder` à moins de 14 jours, `later` ; `launched`, `auto`, `reminder`) et nombre de rappels. |
| POST | `/admin/world-events/launch-template` | Lance un modèle (`templateId`, `days` optionnel, 60 au plus). Un modèle ne se lance qu'une fois par occurrence annuelle : 409 sinon ; 404 modèle inconnu. |
| POST | `/admin/world-events/launch-custom` | Événement personnalisé (`name` de 60 caractères au plus, `days` 1 à 60, `productionBonus` 0 à 1, `marketTaxReduction` 0 à 1, au moins un effet). 400 hors bornes. |
| PUT | `/admin/world-events/templates/:templateId/auto` | Case « automatique » du modèle (`auto` booléen, décochée par défaut). |
| DELETE | `/admin/world-events/:id` | Arrête un événement en cours tout de suite (409 s'il est déjà terminé). |

Chaque lancement ou arrêt **règle d'abord la production de toutes les planètes** avec les bonus encore en vigueur : le temps écoulé n'est jamais recalculé avec un autre bonus. La tâche `world-events` (chaque minute) termine les événements échus et lance ceux dont la case « automatique » est cochée et dont la période est en cours (une fois par an et par modèle ; un événement annulé n'est pas relancé). Les actions administratives sont écrites au journal d'audit (`world_event_launch`, `world_event_cancel`, `world_event_auto`).

## Marché (`/market`)

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/market/offers` | Offres en cours, les moins chères d'abord (`give`, `want`, `limit` optionnels) ; `rules` : taxe, durée, limite d'offres. |
| GET | `/market/mine` | Mes offres actives et mes 20 dernières ventes (rôle vendeur ou acheteur). |
| GET | `/market/history?give=&want=` | Dernières ventes d'une paire, dernier taux, taux moyen pondéré des 10 dernières, bornes autorisées. |
| POST | `/market/offers` | Publie une offre (`planetId`, `give`, `want`, `amount` entier, `rate`, `minAmount` optionnel) : la ressource proposée est débitée en séquestre. 400 taux hors bornes (moitié à double du taux de référence), même ressource, quantité invalide, stock insuffisant ou 10 offres actives ; 404 planète étrangère. |
| POST | `/market/offers/:id/buy` | Achète tout ou partie (`planetId` de l'acheteur, `amount` entier ≥ minimum de l'offre ou le reliquat) : paiement débité, ressource livrée, vendeur crédité du paiement moins 5 % de taxe détruite. 400 quantité, fonds ou offre propre ; 409 offre fermée ou expirée ; 404 offre ou planète inconnue. |
| DELETE | `/market/offers/:id` | Retire une offre active du vendeur et rend le séquestre restant (409 si elle n'est plus active, 404 si elle n'est pas au joueur). |

Les offres expirées (24 h) sont fermées chaque minute par la tâche `market`, qui rend le séquestre à la planète d'origine ou, à défaut, à une autre planète du vendeur. Tous les mouvements d'une vente se font dans une transaction qui verrouille l'offre puis les deux planètes (ordre des identifiants).

## Commerce PNJ (`/npc-trade`, `/admin/npc-trade`)

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/npc-trade` | Tout joueur connecté : saison, jour UTC, marge effective du jour, valeur des ressources, facteur de prix des vaisseaux, taux des six paires (`rates`), vaisseaux en vente avec prix unitaire du jour (`ships`), plafonds quotidiens utilisés (`caps`) et heure de remise à zéro (`resetsAt`). |
| POST | `/npc-trade/exchange` | Échange instantané (`planetId`, `give`, `want`, `amount` entier) au taux du jour, marge du marchand comprise (réduite par la saison et par l'événement du monde qui baisse la taxe du marché). 400 même ressource, ressource inconnue, quantité trop faible pour rapporter une unité, stock insuffisant, plafond quotidien atteint ou marchand fermé ; 404 planète étrangère. |
| POST | `/npc-trade/ships` | Achat de vaisseaux (`planetId`, `shipId`, `amount`) : prix du chantier spatial × multiplicateur du serveur × facteur du jour, débité, vaisseaux livrés tout de suite sans prérequis. 400 vaisseau non proposé (le satellite solaire n'est jamais vendu), stock insuffisant, plafond atteint ou marchand fermé ; 404 planète étrangère. |
| GET | `/admin/npc-trade` | ADMIN ou SUPER_ADMIN : réglage courant, valeurs par défaut, bornes, saisons et vaisseaux vendables. |
| PUT | `/admin/npc-trade` | ADMIN ou SUPER_ADMIN : remplace tout le réglage (`enabled`, `spread` 0 à 0,5, `dailyVariation` 0 à 0,5, `exchangeDailyCap`, `shipDailyCap`, `shipPriceMultiplier` 0,5 à 10, `ships`, `seasons.<saison>.{values, spreadReduction, shipDiscount}`). 400 avec la liste des champs invalides, sans rien enregistrer ; inscrit au journal d'audit (`update_npc_trade`, avant/après). |
| DELETE | `/admin/npc-trade` | ADMIN ou SUPER_ADMIN : revient aux valeurs par défaut (audit `reset_npc_trade`). |

Les échanges d'un même joueur sont sérialisés par un verrou sur le joueur : le plafond quotidien (valeur équivalent métal, jour UTC) ne peut pas être dépassé par des requêtes simultanées. Le réglage est stocké dans `GameConfig` (clé `npcTrade.config`) ; un réglage absent ou corrompu retombe sur les valeurs par défaut. Table `NpcTrade` (migration `20261024100000_npc_trade`) : historique et base des plafonds.

## Attaques groupées (mission 2)

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| POST | `/fleet/send` (`mission: 2`) | Sans `groupId` : crée un groupe (le joueur doit être dans une alliance, la cible est hors de l'alliance et d'un autre joueur) et fixe l'arrivée. Avec `groupId` : rejoint le groupe de son alliance (404 groupe étranger ou inconnu, 400 autre cible, groupe déjà parti, groupe complet : 5 flottes, flotte qui retarderait le groupe de plus de 30 % de sa durée prévue à la création). Une flotte plus lente que le groupe le **retarde** : l'arrivée du groupe et celle de chaque flotte déjà partie sont repoussées (retour décalé d'autant). La réponse contient `groupId`, `arrivalTime` et `groupDelayed`. |
| GET | `/fleet/attack-groups` | Groupes de l'alliance du joueur encore en route : `id`, `creator`, `target`, `arrivalTime`, `fleets`. |

À l'arrivée, un seul combat réunit les flottes du groupe (technologies et commandant de chacune) ; butin partagé au prorata de la place libre ; un rapport par participant (`participants` dans le détail du rapport) ; le groupe est supprimé après le combat.

## Commandants de flotte (`/fleet-commanders`)

| Méthode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/fleet-commanders` | Commandants du joueur (niveau, expérience, points, compétences, bonus, `busy`), prix (250 000 deutérium), limite (3). |
| POST | `/fleet-commanders` | Recrute (`name` 2–24 caractères, `planetId` qui paie). 400 limite atteinte ou deutérium insuffisant, 404 planète étrangère. |
| POST | `/fleet-commanders/:id/skills/:skill` | Dépense un point (`attack`, `defense`, `speed`, `cargo` ; 10 niveaux au plus), atomique. 400 sans point ou au maximum, 404 commandant d'un autre joueur. |
| DELETE | `/fleet-commanders/:id` | Renvoie un commandant libre (400 s'il est en mission). |

L'assignation se fait à l'envoi : `POST /fleet/send` accepte `commanderId` (404 s'il n'est pas au joueur, 400 s'il est déjà en mission). Vitesse et capacité de cargaison en bénéficient dès l'envoi, attaque, défense et cargaison de butin à la résolution d'un combat d'attaque ; l'expérience est créditée à ce moment, et le commandant meurt avec 10 % de chances si toute la flotte est détruite.

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
