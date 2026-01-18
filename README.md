# XNova Reforged

Refonte moderne de XNova, un MMORPG de stratégie spatiale. Monorepo NestJS + Next.js orienté temps réel, performance et évolutivité.

## Statut

MVP en cours (Sprint 10 - Polish & Tests). Détails dans `ROADMAP_MVP.md`.

## Stack technique

**Backend**
- NestJS (TypeScript)
- Prisma ORM
- PostgreSQL 16
- Redis 7
- Socket.io

**Frontend**
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- Zustand
- React Query

**DevOps**
- Docker + Docker Compose
- Turborepo

## Structure du projet

```
XNova-reforged/
├── apps/
│   ├── api/              # Backend NestJS
│   └── web/              # Frontend Next.js
├── packages/
│   ├── database/         # Prisma schema + client
│   ├── game-config/      # Config statique du jeu
│   ├── game-engine/      # Logique métier pure
│   └── ui/               # Composants UI partagés
├── tests/                # Tests E2E Playwright
├── docker-compose.yml
├── GETTING_STARTED.md
└── README.md
```

## Démarrage rapide

### Prérequis
- Node.js >= 20
- npm >= 10
- Docker + Docker Compose

### Installation

```bash
# Cloner le repo
git clone <url>
cd XNova-reforged

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Mettre à jour .env si besoin
# IMPORTANT : garder DATABASE_URL cohérente avec packages/database/.env

# Démarrer PostgreSQL + Redis
npm run docker:up

# Initialiser la base de données
npm run db:push
cd packages/database && npm run db:generate
cd ../..

# Lancer en développement
npm run dev
```

### URLs locales
- Frontend : http://localhost:3000
- API : http://localhost:3001
- Prisma Studio : http://localhost:5555 (après `npm run db:studio`)

Pour une installation détaillée : `GETTING_STARTED.md`

## Documentation

- `GETTING_STARTED.md` - Guide d'installation complet
- `ROADMAP_MVP.md` - Roadmap MVP
- `ROADMAP_COMPLET.md` - Roadmap long terme
- `GAME_FORMULAS.md` - Formules de jeu (référence)
- `STRATEGIE_UPGRADE.md` - Stratégie de refonte
- `docs/PLAYER_GUIDE.md` - Guide joueur condensé (économie, combat, social, admin)
- `docs/API_ENDPOINTS.md` - Référence des endpoints API (auth, planètes, bâtiments, etc.)
- `docs/BALANCE.md` - Paramètres / multiplicateurs utilisés pour l’équilibrage
- `docs/INTEGRATION_TESTS.md` - Mise en place des tests d'intégration NestJS
- `SKILL.md` - **Guide complet des tests** (unitaires, intégration, E2E)

## Tests

```bash
# Tests unitaires API
npm run test

# Tests E2E Playwright
npm run test:e2e
npm run test:e2e:ui

# Tests integration API (NestJS)
npm run test:integration
```

**Pour un guide complet des tests, voir [`SKILL.md`](SKILL.md) et [`docs/INTEGRATION_TESTS.md`](docs/INTEGRATION_TESTS.md).**

Notes rapides :
- Tests unitaires : `apps/api/test/*.spec.ts` (mocks, logique métier)
- Tests intégration : `apps/api/test/integration/` (vraie DB, requiert Docker)
- Couverture intégration actuelle : `auth.integration.spec.ts` (auth + `GET /auth/me`) et `planets.integration.spec.ts` (liste bâtis + file build/cancel).
- Tests E2E : `tests/e2e/` (Playwright, interface utilisateur)
- **IMPORTANT** : Les noms d'utilisateur sont limités à 20 caractères
- Si erreur Reflector : ajouter `Reflector` aux providers du module

## Scripts utiles

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run docker:up
npm run docker:down
npm run db:push
npm run db:studio
```

## Contribution

Les contributions sont bienvenues. Ouvrez une issue pour discuter d'une idée ou proposez une PR.

## Licence

GNU GPL v2 - voir `LICENSE`.

## Crédits

Basé sur le projet original [XNova](http://www.xnova.fr/) (2008) par la XNova Team.
