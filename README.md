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

## Tests

```bash
# Tests E2E Playwright
npm run test:e2e
npm run test:e2e:ui
```

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
