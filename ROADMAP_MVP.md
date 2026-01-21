# 🚀 ROADMAP MVP - XNOVA REFORGE

> Refonte moderne du projet XNova avec technologies 2026
> **Durée estimée :** 3-4 mois | **Stack :** NestJS + Next.js + PostgreSQL + Redis

---

## 📊 Vue d'ensemble du MVP

### Objectif
Créer une version jouable minimale mais complète du jeu XNova avec :
- ✅ Système d'authentification sécurisé
- ✅ Gestion de ressources en temps réel
- ✅ Construction de bâtiments et technologies
- ✅ Système de flottes et combat basique
- ✅ Exploration galactique
- ✅ Features sociales (messagerie, alliances)

### Stack Technologique

**Backend**
- Node.js 22+ / Bun
- NestJS (TypeScript)
- Prisma ORM
- PostgreSQL 16
- Redis (cache + sessions)
- Socket.io (temps réel)

**Frontend**
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- Zustand (state)
- React Query
- Framer Motion

**DevOps**
- Docker + Docker Compose
- GitHub Actions
- Vercel/Railway
- Sentry

---

## 📅 PHASE 1 : Fondations (Semaine 1-4)

### Sprint 1A : Infrastructure Backend ✅ TERMINÉ

**Objectif :** Mettre en place l'infrastructure backend et base de données

#### Backend
- [x] Initialiser monorepo (Turborepo)
- [x] Setup NestJS avec structure modulaire
  ```
  apps/
    api/
      src/
        auth/
        database/
        common/
  ```
- [x] Configuration Prisma + PostgreSQL
- [x] Setup Redis pour sessions et cache
- [x] Docker Compose (PostgreSQL, Redis)
- [x] Variables d'environnement (.env)
- [x] Configuration TypeScript (tsconfig.json)

#### DevOps
- [x] Docker Compose dev environment
- [ ] Dockerfile pour API - **À faire Sprint 1B**
- [ ] ESLint + Prettier - **À faire Sprint 1B**
- [ ] GitHub Actions CI basique - **Optionnel**
- [ ] Husky pre-commit hooks - **Optionnel**
- [x] Maintenance securite npm (@nestjs/cli/@nestjs/schematics) - **Jan 2026**

**Livrables :**
- ✅ Backend NestJS fonctionnel
- ✅ Base de données Prisma opérationnelle
- ✅ Services Docker actifs
- ✅ Hot-reload backend

**Complété le :** 14 janvier 2026 (Session 1)

---

### Sprint 1B : Infrastructure Frontend ✅ TERMINÉ

**Objectif :** Mettre en place l'infrastructure frontend Next.js

#### Frontend
- [x] Setup Next.js 15 avec App Router
- [x] Configuration TailwindCSS
- [x] Installation shadcn/ui
- [x] Setup Zustand stores
- [x] Configuration React Query
- [x] Layout de base (header, nav, footer)
- [x] Création structure routes :
  ```
  app/
    (auth)/
      login/
      register/
    (game)/
      overview/
      buildings/
      research/
    layout.tsx
    page.tsx
  ```

#### DevOps Frontend
- [ ] Dockerfile pour Next.js
- [ ] ESLint + Prettier configuration
- [ ] Variables d'environnement Next.js

**Livrables :**
- ✅ Frontend Next.js fonctionnel
- ✅ UI de base avec TailwindCSS
- ✅ Routing configuré
- ✅ Hot-reload frontend

**Notes :** DevOps frontend (Dockerfile/ESLint/env) reporté.
**Complété le :** 14 janvier 2026 (Session 3)

---

### Sprint 2A : Authentification Backend ✅ TERMINÉ

**Objectif :** Système d'auth backend complet et sécurisé

#### Backend - Module Auth
- [x] Schema Prisma `User`
  ```prisma
  model User {
    id            String   @id @default(uuid())
    username      String   @unique
    email         String   @unique
    password      String
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }
  ```
- [x] JWT strategy (access + refresh tokens)
- [x] Password hashing (Argon2)
- [x] Endpoints :
  - [x] `POST /auth/register`
  - [x] `POST /auth/login`
  - [x] `POST /auth/logout`
  - [x] `POST /auth/refresh`
  - [x] `GET /auth/me`
- [x] Guards NestJS (JwtAuthGuard)
- [ ] Rate limiting (ThrottlerModule) - À faire plus tard
- [x] Validation DTO (class-validator)

#### Frontend - Pages Auth
- [x] Page `/register`
- [x] Page `/login`
- [ ] Page `/logout`
- [x] Composants formulaires (shadcn Form)
- [x] Validation côté client (zod)
- [x] Gestion tokens (localStorage/cookies)
- [x] Protected routes (middleware)
- [x] Auto-refresh tokens

#### Sécurité
- [ ] Helmet.js (headers sécurisés) - À faire plus tard
- [x] CORS configuration
- [ ] CSRF protection - À faire plus tard
- [ ] Rate limiting par IP - À faire plus tard
- [ ] Email verification (optionnel MVP)

**Livrables :**
- ✅ Inscription/connexion fonctionnels (Backend)
- ✅ Sessions sécurisées (JWT)
- ✅ Gestion erreurs complète
- ✅ Création automatique planète de départ

**Complété le :** 14 janvier 2026 (Session 2)

---

### Sprint 2B : Authentification Frontend ✅ TERMINÉ

**Objectif :** Pages d'authentification frontend

#### Frontend - Pages Auth
- [x] Page `/register`
  - Formulaire avec validation (zod)
  - Gestion erreurs
  - Redirection après succès
- [x] Page `/login`
  - Formulaire avec validation
  - Gestion "Se souvenir de moi"
  - Lien mot de passe oublié
- [x] Composants formulaires (shadcn Form)
- [x] Validation côté client (zod)
- [x] Gestion tokens (localStorage + cookies)
- [x] Protected routes (middleware Next.js)
- [x] Auto-refresh tokens
- [x] Composant `ProtectedRoute`
- [x] Store Zustand pour authentification

**Livrables :**
- ✅ Pages login/register fonctionnelles
- ✅ Connexion frontend ↔ backend API
- ✅ Routes protégées
- ✅ Gestion session utilisateur

**Complété le :** 15 janvier 2026 (Session 4)

---

## 📅 PHASE 2 : Gameplay Core (Semaine 5-10)

### Sprint 3 : Système de Ressources ✅ TERMINÉ

**Objectif :** Production et gestion des ressources en temps réel

#### Backend - Module Resources
- [x] Schema Prisma
  ```prisma
  model Planet {
    id              String   @id @default(uuid())
    userId          String
    user            User     @relation(fields: [userId], references: [id])
    name            String
    galaxy          Int
    system          Int
    position        Int

    metal           Float    @default(500)
    crystal         Float    @default(500)
    deuterium       Float    @default(0)
    energy          Int      @default(0)

    metalMine       Int      @default(0)
    crystalMine     Int      @default(0)
    deuteriumMine   Int      @default(0)
    solarPlant      Int      @default(0)

    lastUpdate      DateTime @default(now())
  }
  ```
- [x] Service de calcul production
  - Formules OGame (production par niveau)
  - Consommation énergétique
  - Stockage maximum
- [x] Cron job update ressources (toutes les minutes)
- [x] WebSocket events ressources
- [x] Endpoints :
  - `GET /planets/:id`
  - `GET /planets/:id/resources`

#### Game Engine - Package @xnova/game-engine
- [x] Fonction `updateResources()` avec formules exactes
- [x] Gestion énergie (déficit affecte production)
- [x] Limites de stockage
- [x] Calculs production par seconde

#### Backend - WebSocket Gateway
- [x] Module `GameEventsGateway` avec Socket.io
- [x] Authentification JWT pour WebSocket
- [x] Rooms basées sur planètes (`planet:${id}`)
- [x] Événements :
  - `resources:updated`
  - `building:completed`
  - `research:completed`
  - `fleet:arrived`

#### Backend - Cron Jobs
- [x] Service `ResourcesCronService`
- [x] Cron toutes les minutes (planètes actives <24h)
- [x] Cron horaire (planètes inactives)
- [x] Émission WebSocket après chaque mise à jour
- [x] Ajout champ `lastActive` sur User

#### Frontend - UI Ressources
- [x] Composant `ResourceDisplay`
  - Compteurs animés
  - Barres de progression
  - Production par heure
  - Formatage nombres (K, M, B)
- [x] Composant `EnergyDisplay`
  - Statut production/consommation
  - Indicateur déficit
- [x] WebSocket connection (Socket.io client)
- [x] Provider `SocketProvider` avec SSR handling
- [x] Hook `usePlanetResources()` (React Query + WebSocket)
- [x] Auto-update temps réel
- [x] Dashboard planète (`/overview`)
- [x] Sélecteur multi-planètes
- [x] Indicateur connexion temps réel

**Livrables :**
- ✅ Ressources produites en temps réel
- ✅ Affichage dynamique
- ✅ Calculs précis
- ✅ WebSocket bidirectionnel fonctionnel
- ✅ Cron jobs actifs
- ✅ Frontend avec animations

**Complété le :** 14 janvier 2026 (Session 8)

**Tests validés :**
- ✅ Compte test : `player1` / `Player123`
- ✅ Login fonctionnel
- ✅ WebSocket connecté
- ✅ Ressources temps réel
- ✅ Cron job toutes les minutes

**Métriques :**
- 21 fichiers créés/modifiés
- ~1,200 lignes de code
- 3 systèmes majeurs (Cron, WebSocket, Frontend Temps Réel)

---

### Sprint 3.5 : Refonte Frontend & Navigation ✅ TERMINÉ

**Objectif :** Refonte UI/UX 2026 tout en gardant l'esprit XNova, avec navigation fluide pour tests utilisateurs.

#### UX/Navigation globale
- [x] Nouvelle navigation principale (planète, bâtiments, technologies, flottes, galaxie, messages)
- [x] Accès direct aux pages clés depuis la planète (overview → bâtiments/technos/détails)
- [x] Pages dédiées par bâtiment (fiche + actions)
- [x] Pages dédiées par technologie (fiche + prérequis + recherche)
- [x] Parcours mobile-first pour navigation rapide
- [x] Carte commandant + panneau stats compte depuis l'overview
- [x] Renommage planète (UI + API)

#### Design system "XNova 2026"
- [x] Palette et typographies cohérentes (futuriste, lisible)
- [x] Composants réutilisables (cards, panneaux, jauges, badges)
- [x] Hiérarchie visuelle claire (états disponibles/en cours/verrouillé)
- [x] Animations sobres (transitions, apparitions, focus)

#### Pages prioritaires
- [x] `/overview` (planète centrale + hubs d'accès)
- [x] `/buildings` (liste + filtres + fiche bâtiment)
- [x] `/research` (arbre techno + fiche recherche)
- [x] `/fleet` (navigation + préparation)
- [x] `/galaxy` (navigation + actions)

**Livrables :**
- ✅ Navigation jeu testable de bout en bout
- ✅ UI cohérente 2026 sans perdre l'identité XNova
- ✅ Base UX pour tests utilisateurs

**Commencé le :** 15 janvier 2026 (Session 10)
**Complété le :** 15 janvier 2026 (Session 19)

---

### Sprint 4 : Construction de Bâtiments ✅ TERMINÉ

**Objectif :** Système de construction avec file d'attente

#### Backend - Module Buildings
- [x] Schema Prisma ✅
  ```prisma
  model BuildQueue {
    id          String   @id @default(uuid())
    planetId    String
    planet      Planet   @relation(fields: [planetId], references: [id])
    buildingId  Int
    level       Int
    startTime   DateTime
    endTime     DateTime
    completed   Boolean  @default(false)
  }
  ```
  **Note:** Modèle déjà présent dans schema.prisma (lignes 118-134)

- [x] Configuration bâtiments ✅
  - 15 bâtiments définis avec coûts, facteurs, catégories
  - Fonction `getBuildingCost()` - Calcul exponentiel des coûts
  - Fonction `getBuildingTime()` - Calcul durée construction
    - Formule: `(metal + crystal) / (2500 * (1 + robotics) * 2^nanite)`
    - Bonus ingénieur: -5% par niveau
  - Fonction `checkBuildingRequirements()` - Vérification prérequis
  - Fonction `getDemolitionRefund()` - Remboursement 25%

- [x] Service BuildingService
  - [x] Logique création construction
  - [x] Validation ressources disponibles
  - [x] Gestion file d'attente
  - [x] Application coûts et mise à jour ressources

- [x] Cron job finalisation constructions
- [x] Endpoints :
  - [x] `GET /buildings` - Liste des bâtiments
  - [x] `POST /planets/:id/build` - Démarrer construction
  - [x] `GET /planets/:id/build-queue` - Voir file d'attente
  - [x] `DELETE /planets/:id/build-queue/:queueId` - Annuler construction

#### Frontend - UI Buildings
- [x] Page `/buildings`
- [x] Liste bâtiments disponibles
  - Nom, niveau actuel, coûts
  - Temps construction
  - Bouton build (disabled si pas assez ressources)
- [x] File d'attente visuelle
  - Countdown timer
  - Progression
- [x] Notifications build terminé (toast)

**Livrables :**
- ✅ Construction bâtiments fonctionnelle
- ✅ File d'attente
- ✅ Système de coûts équilibré (formules implémentées)

**Progression actuelle :** 5/5 tâches backend complétées (100%)

**Commencé le :** 14 janvier 2026 (Session 9)
**Complété le :** 15 janvier 2026 (Session 20)

**Fichiers modifiés cette session :**
- `packages/game-config/src/buildings.ts` - Ajout fonctions de calcul
- `packages/game-config/src/technologies.ts` - Correction interface TechCost
- `packages/game-config/tsconfig.json` ✅ NEW

---

### Sprint 5 : Technologies ✅ TERMINÉ

**Objectif :** Arbre technologique et recherche

#### Backend - Module Research
- [x] Schema Prisma
  ```prisma
  model Technology {
    id       String @id @default(uuid())
    userId   String
    user     User   @relation(fields: [userId], references: [id])
    techId   Int
    level    Int    @default(0)
  }

  model ResearchQueue {
    id        String   @id @default(uuid())
    userId    String
    planetId  String
    techId    Int
    level     Int
    startTime DateTime
    endTime   DateTime
    completed Boolean  @default(false)
  }
  ```
- [x] Configuration technologies
  ```typescript
  {
    1: { // Espionnage
      name: 'Technologie Espionnage',
      baseCost: { metal: 200, crystal: 1000, deuterium: 200 },
      requirements: { researchLab: 3 }
    }
  }
  ```
- [x] Service ResearchService
  - Vérification prérequis (bâtiments requis)
  - Une seule recherche à la fois
  - Calcul durée
- [x] Endpoints :
  - `GET /technologies`
  - `POST /research`
  - `GET /research-queue`
  - `DELETE /research-queue/:id`

#### Frontend - UI Technologies
- [x] Page `/research`
- [x] Arbre technologique interactif
  - Nœuds connectés (lignes)
  - États : disponible, locked, en cours
  - Tooltips détaillés
- [x] Barre recherche en cours
- [x] Effets visuels (glow pour disponibles)

**Livrables :**
- ✅ Système de recherche complet
- ✅ Arbre tech visuel
- ✅ Prérequis fonctionnels

**Complété le :** 15 janvier 2026 (Session 22)

---

### Sprint 6 : Système de Flottes ✅ TERMINÉ

**Objectif :** Gestion et déplacement de flottes

#### Backend - Module Fleet
- [x] Schema Prisma
  ```prisma
  model Ship {
    id       String @id @default(uuid())
    planetId String
    planet   Planet @relation(fields: [planetId], references: [id])
    shipId   Int
    amount   Int
  }

  model Fleet {
    id              String   @id @default(uuid())
    userId          String
    user            User     @relation(fields: [userId], references: [id])

    fromGalaxy      Int
    fromSystem      Int
    fromPosition    Int

    toGalaxy        Int
    toSystem        Int
    toPosition      Int

    mission         Int      // 1=Attack, 3=Transport, 6=Spy
    ships           Json     // { "202": 10, "203": 5 }
    cargo           Json     // { metal: 1000, crystal: 500 }

    startTime       DateTime
    arrivalTime     DateTime
    returnTime      DateTime?
    status          String   // traveling, arrived, returning
  }
  ```
- [x] Configuration vaisseaux
  ```typescript
  {
    202: { // Petit Transporteur
      name: 'Petit Transporteur',
      cost: { metal: 2000, crystal: 2000 },
      speed: 5000,
      cargo: 5000,
      consumption: 10
    }
  }
  ```
- [x] Service FleetService
  - Calcul vitesse flotte (vaisseau le plus lent)
  - Calcul durée voyage
  - Consommation deuterium
  - Validation cibles
- [x] Cron job gestion flottes
  - Arrivée : exécuter mission
  - Retour : restituer vaisseaux
- [x] WebSocket events (flotte arrivée)
- [x] Endpoints :
  - [x] `POST /fleet/send`
  - [x] `GET /fleet/active`
  - [x] `DELETE /fleet/:id` (rappeler avant arrivée)

#### Frontend - UI Fleet
- [x] Page `/fleet`
  - Sélection vaisseaux
  - Sélection destination (galaxie/système/position)
  - Choix mission
  - Chargement cargo (si transport)
  - [x] Calcul durée affichée
- [x] Page `/movement`
  - [x] Liste flottes en cours
  - [x] Countdown timers
  - [x] Rappel possible

**Livrables :**
- ✅ Envoi flottes fonctionnel
- ✅ Missions transport
- ✅ Tracking temps réel

**Complété le :** 15 janvier 2026 (Session 23-24)

---

### Sprint 6B : Hangar Spatial ✅ TERMINÉ

**Objectif :** Construction et gestion des vaisseaux

#### Backend - Module Shipyard
- [x] Schema Prisma (file d’attente vaisseaux)
- [x] Service ShipyardService (coûts, temps, validation ressources)
- [x] Cron job construction vaisseaux
- [x] Endpoints :
  - [x] `GET /shipyard`
  - [x] `POST /shipyard/build`
  - [x] `GET /shipyard/queue`
  - [x] `DELETE /shipyard/queue/:id`

#### Frontend - UI Hangar
- [x] Page `/shipyard`
  - [x] Liste vaisseaux disponibles
  - [x] Construction vaisseaux
  - [x] File d’attente + timers

**Livrables :**
- ✅ Construction vaisseaux fonctionnelle
- ✅ File d’attente shipyard

**Complété le :** 15 janvier 2026 (Session 25)

**Note :** Correction relation Prisma `ShipQueue` ↔ `Planet` (Session 26)

---

### Sprint 7 : Combat Simplifié ✅ TERMINÉ

**Objectif :** Moteur de combat basique

#### Backend - Module Combat
- [x] Schema Prisma
  ```prisma
  model CombatReport {
    id          String   @id @default(uuid())
    attackerId  String
    defenderId  String
    attackerShips Json
    defenderShips Json
    result      String   // win, lose, draw
    loot        Json
    debris      Json
    createdAt   DateTime @default(now())
  }
  ```
- [x] Service CombatEngine
  - Calcul puissances (attaque, défense, bouclier)
  - Simulation tour par tour (max 6 rounds)
  - Génération débris (30% coûts détruits)
  - Pillage ressources (50% max)
  - Rapport combat détaillé
- [x] Configuration combat
  ```typescript
  {
    202: { // Petit Transporteur
      hull: 4000,
      shield: 10,
      weapon: 5
    }
  }
  ```
- [x] Intégration avec FleetService
  - [x] Mission Attack
  - [x] Retour survivants
  - [x] Notification rapport

#### Frontend - UI Combat
- [x] Page `/reports`
  - [x] Liste rapports de combat
  - [x] Filtres (gagnés, perdus, tout)
- [x] Composant `CombatReport`
  - [x] Récapitulatif bataille
  - [x] Pertes des deux côtés
  - [x] Butin/débris
  - [x] Timeline rounds (optionnel)
- [x] Notifications combat

**Livrables :**
- ✅ Combats fonctionnels
- ✅ Rapports détaillés
- ✅ Équilibrage basique

**Complété le :** 15 janvier 2026 (Session 32)

---

### Sprint 8 : Galaxie & Exploration ✅ TERMINÉ

**Objectif :** Vue galaxie et colonisation

#### Backend - Module Galaxy
- [x] Génération galaxie au démarrage
  - 9 galaxies
  - 499 systèmes par galaxie
  - 15 positions par système
  - Planètes joueurs + planètes abandonnées
- [x] Endpoints :
  - [x] `GET /galaxy/:galaxy/:system`
  - [x] `POST /planets/colonize`
  - [x] `GET /planets/scan/:id` (scan ressources)

#### Frontend - UI Galaxy
- [x] Page `/galaxy`
  - [x] Sélecteurs galaxie/système
  - [x] Tableau 15 positions
  - [x] Infos planètes :
    - [x] Nom joueur
    - [x] Alliance
    - [x] Activité
    - [x] Lune
  - [x] Boutons actions (espionner, attaquer, transporter)
- [x] UI colonisation
  - [x] Vaisseau colon requis
  - [x] Choix position libre
  - [x] Nom planète

**Livrables :**
- ✅ Vue galaxie fonctionnelle
- ✅ Colonisation
- ✅ Scanner planètes

---

## 📅 PHASE 4 : Social & Polish (Semaine 13-16)

### Sprint 9 : Système Social ✅ TERMINÉ

**Objectif :** Messagerie et alliances

#### Backend - Module Social
- [x] Schema Prisma
  ```prisma
  model Message {
    id         String   @id @default(uuid())
    fromId     String
    from       User     @relation("SentMessages", fields: [fromId], references: [id])
    toId       String
    to         User     @relation("ReceivedMessages", fields: [toId], references: [id])
    subject    String
    body       String
    read       Boolean  @default(false)
    createdAt  DateTime @default(now())
  }

  model Alliance {
    id          String   @id @default(uuid())
    tag         String   @unique
    name        String
    founderId   String
    description String?
    createdAt   DateTime @default(now())
  }

  model AllianceMember {
    id         String   @id @default(uuid())
    allianceId String
    alliance   Alliance @relation(fields: [allianceId], references: [id])
    userId     String
    user       User     @relation(fields: [userId], references: [id])
    rank       Int      @default(0)
    joinedAt   DateTime @default(now())
  }
  ```
- [x] Endpoints messagerie :
  - [x] `GET /messages/inbox`
  - [x] `GET /messages/:id`
  - [x] `POST /messages/send`
  - [x] `DELETE /messages/:id`
- [x] Endpoints alliances :
  - [x] `POST /alliances/create`
  - [x] `POST /alliances/:id/invite`
  - [x] `POST /alliances/:id/join`
  - [x] `GET /alliances/:id`
  - [x] `DELETE /alliances/:id/leave`

#### Frontend - UI Social
- [x] Page `/messages`
  - [x] Inbox (non lus en gras)
  - [x] Nouveau message
  - [x] Lecture message
  - [x] Suppression
- [x] Page `/alliance`
  - [x] Création alliance
  - [x] Liste membres
  - [x] Invitations
  - [x] Description
- [x] Page `/statistics`
  - [x] Classements joueurs
  - [x] Top alliances
  - [x] Statistiques personnelles

**Livrables :**
- ✅ Messagerie complète
- ✅ Système alliances basique
- ✅ Classements

---

### Sprint 9.5 : Administration Serveur ✅ TERMINÉ

**Objectif :** Interface admin pour régler les paramètres globaux du jeu

#### Backend - Configuration
- [x] Modèle `GameConfig` (vitesses, tailles planètes, multiplicateurs)
- [x] Endpoints admin sécurisés (RBAC)
  - [x] `GET /admin/config`
  - [x] `PUT /admin/config`
- [x] Validation stricte des valeurs (bornes, types)
- [x] Journalisation des modifications (audit log)

#### Frontend - UI Admin
- [x] Page `/admin` (layout dédié)
- [x] Écran “Configuration serveur”
  - [x] Vitesse du jeu
  - [x] Vitesse des flottes
  - [x] Vitesse de production
  - [x] Taille planète / cases disponibles
  - [x] Multiplicateurs ressources de base
- [x] Écran “Vue générale” (statut serveur)

#### Extensions admin (addons)
- [x] Gestion des rôles (MODERATOR/ADMIN/SUPER_ADMIN) + promotion joueur
- [x] Modération : bannir/débannir + historique
- [x] Audit log détaillé consultable
- [x] Macro admin : boost développement total (SUPER_ADMIN)
- [x] Plafond niveaux bâtiments/technologies configurable
- [ ] Mode maintenance (message global + whitelist admin)
- [ ] Profil joueur avancé (stats, IP, activité)
- [ ] Anti-cheat basique (alertes seuils)
- [ ] Macros admin (reset éco, recalc points)

**Livrables :**
- ✅ Paramètres globaux modifiables en live
- ✅ Traçabilité des changements

---

### Sprint 10 : Polish & Tests ⏳ EN COURS

**Objectif :** Finaliser le MVP pour alpha testing

#### Tests
- [x] Tests E2E Playwright
  - [x] Parcours inscription → connexion
  - [x] Correctif Playwright (regex URL `/overview`)
  - [x] Ajustement données E2E (username/email validés)
  - [x] Remplacement des sélecteurs par IDs pour l’inscription E2E
  - [x] Parcours build bâtiment
  - [x] Parcours envoi flotte
  - [x] Parcours combat
  - [x] Ajustement timeouts Playwright (navigation + attentes)
  - [x] Playwright Chromium-only + webServer API/Web séparés
  - [x] Script `test:e2e` forcé sur Chromium
- [x] Pré-requis Playwright (script multi-OS + Fedora)
- [x] Tests unitaires critiques
  - [x] Services calculs (ressources, combat)
  - [x] Guards auth
  - [x] Validations
- [x] Tests intégration API
  - [x] Auth + planètes (smoke)
  - [x] Stabilisation Jest (imports .js + ts-jest + isolatedModules)
  - [x] Injection RolesGuard pour tests integration
  - [x] Technologies / Recherche (`research.integration.spec.ts`)
  - [x] Flottes (`fleet.integration.spec.ts`)
  - [x] Chantier spatial (`shipyard.integration.spec.ts`)
  - [x] Galaxie (`galaxy.integration.spec.ts`)
  - [x] Messagerie (`messages.integration.spec.ts`)
  - [x] Alliances (`alliances.integration.spec.ts`)
  - [x] Statistiques (`statistics.integration.spec.ts`)
  - [ ] Alignement versions NestJS (Swagger v7 + reinstall) - optionnel
- [x] Documenté la procédure (`docs/INTEGRATION_TESTS.md`) avec table de couverture des endpoints

**Notes integration (recap)**
- Config Jest: `apps/api/jest.integration.config.cjs` (mapping `.js` -> `.ts` + ts-jest transform)
- 9 fichiers de tests couvrant tous les endpoints critiques
- Lancer avec `cd apps/api && npm run test:integration` (nécessite Docker postgres/redis)

#### Performance
- [x] Optimisation queries Prisma
  - [x] Indexes sur colonnes frequentes
  - [ ] Select minimal (pas de `select *`)
- [x] Cache Redis
  - [x] Configuration serveur
  - [x] Classements
- [x] Frontend optimization
  - [x] Code splitting (lazy-load non critique)
  - [ ] Lazy loading images (aucune balise <img> a convertir)
  - [x] Memoization composants
  - [x] Build config (optimizeCss, removeConsole)

#### Monitoring & Production
- [x] Health checks API (`/health`, `/health/ready`, `/health/live`)
- [x] Monitoring metrics en mémoire + endpoints RBAC
- [x] Sentry backend (Node) + frontend (Next.js)
- [x] Scripts backup/restauration DB
- [x] Workflow GitHub Actions de backup quotidien
- [x] Variables Sentry dans `.env` / `.env.example` + `.gitignore`

#### Balance du jeu ✅ TERMINÉ
- [x] Multiplicateurs d equilibrage configurables (batiments/technos/vaisseaux)
- [x] Équilibrage coûts bâtiments (factor 2.0 → 1.8 pour stratégiques)
- [x] Équilibrage coûts technologies (factor 2.0 → 1.8 universel sauf Graviton)
- [x] Équilibrage coûts/stats vaisseaux (Petit Transport +20%, Chasseur Léger -17%)
- [x] Taux production ressources (formules complètes implémentées)
- [x] Création fichier defenses.ts (10 types de défenses)
- [x] Création fichier production.ts (formules OGame legacy)
- [x] Création fichier multipliers.ts (presets serveur x1, x2.5, x5, x10)
- [x] Documentation équilibrage (docs/GAME_BALANCE.md)

#### UI/UX Polish
- [x] **Multi-langue (i18n) ✅ TERMINÉ**
  - [x] Installation et configuration next-intl
  - [x] Fichiers de traduction FR/EN complets (400+ lignes chacun)
  - [x] Middleware de détection automatique de langue
  - [x] Restructuration app/ avec segment [locale]
  - [x] Traduction pages d'authentification
  - [x] Sélecteur de langue dans l'UI (Header)
  - [x] Documentation complète (docs/I18N_GUIDE.md)
  - [x] Build réussi avec corrections TypeScript Next.js 15
- [x] Design system cohérent
- [x] Animations fluides
- [ ] États de chargement partout
- [ ] Gestion erreurs user-friendly
- [x] États de chargement & erreurs (skeletons, toasts, offline)
- [x] Responsive mobile (auth + home + pages principales + overview + fix overflow)
- [x] Page Défense (placeholder)
- [x] Accessibilité (ARIA labels + menus de langue/user, ressources en temps réel)

#### Documentation
- [x] README complet
- [x] Guide installation
- [x] Guide joueur (règles)
- [x] API documentation (Swagger)
- [x] API reference (docs/API_ENDPOINTS.md)
- [x] Comments code critiques

**Livrables :**
- ✅ MVP stable et testé
- ✅ Prêt pour alpha testing
- ✅ Documentation complète

---

## 🎯 Critères de Succès MVP

### Fonctionnels
- ✅ 100 joueurs simultanés minimum
- ✅ Temps réponse API < 200ms
- ✅ WebSocket latency < 50ms
- ✅ Uptime > 99%

### Gameplay
- ✅ Boucle de jeu addictive
- ✅ Progression satisfaisante (early game)
- ✅ Premiers combats après 1h de jeu
- ✅ Colonisation possible après 2-3h

### Technique
- ✅ 0 bugs critiques
- ✅ Code coverage > 70%
- ✅ Lighthouse score > 90
- ✅ Bundle size < 500kb

---

## 📊 Métriques à Tracker (MVP)

### Engagement
- Nombre inscriptions/jour
- Taux rétention J1, J7, J30
- Temps session moyen
- Actions par session

### Performance
- Latency API (p50, p95, p99)
- Database queries/sec
- WebSocket connections
- Error rate

### Gameplay
- Temps moyen premier combat
- Nombre planètes moyen par joueur
- Distribution niveaux bâtiments
- Combats/jour

---

## 🛠️ Stack Technique Détaillée

### Backend
```json
{
  "@nestjs/core": "^10.0.0",
  "@nestjs/jwt": "^10.0.0",
  "@prisma/client": "^5.0.0",
  "socket.io": "^4.6.0",
  "redis": "^4.6.0",
  "argon2": "^0.31.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1"
}
```

### Frontend
```json
{
  "next": "^15.0.0",
  "react": "^18.3.0",
  "typescript": "^5.3.0",
  "tailwindcss": "^3.4.0",
  "zustand": "^4.5.0",
  "@tanstack/react-query": "^5.0.0",
  "framer-motion": "^11.0.0",
  "socket.io-client": "^4.6.0",
  "zod": "^3.22.0"
}
```

### DevOps
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: xnova
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./apps/api
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://admin:secret@postgres:5432/xnova
      REDIS_URL: redis://redis:6379

  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
```

---

## 🚀 Déploiement MVP

### Environnements
1. **Development** (local Docker)
2. **Staging** (Railway/Render)
3. **Production** (Vercel + Railway DB)

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
- Lint & Format check
- Tests unitaires
- Tests E2E
- Build backend
- Build frontend
- Deploy staging (auto)
- Deploy prod (manual approval)
```

---

## 📝 Checklist Finale MVP

### Technique
- [ ] Tous les tests passent
- [ ] Pas de warnings console
- [ ] Lighthouse > 90
- [ ] Documentation API complète
- [ ] Variables d'env documentées

### Fonctionnel
- [ ] Parcours joueur complet testé
- [ ] Balance vérifiée
- [ ] Pas de bugs bloquants
- [ ] Support 100+ joueurs simultanés

### Business
- [ ] Metrics configurées
- [ ] Error tracking actif
- [ ] Backups automatiques
- [ ] Plan de rollback

---

**🎉 Après le MVP : Direction la roadmap complète !**
