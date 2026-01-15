# 🚀 XNova Reforged

> Modern space strategy MMORPG - Complete rewrite of XNova with cutting-edge technologies

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5-brightgreen)](https://www.prisma.io/)

## 📖 Description

XNova Reforged est une refonte complète du jeu de stratégie spatial multijoueur XNova, utilisant les technologies web les plus modernes de 2026.

## 🛠️ Stack Technique

### Backend
- **NestJS** - Framework TypeScript enterprise
- **Prisma** - ORM type-safe
- **PostgreSQL 16** - Base de données
- **Redis 7** - Cache et sessions
- **Socket.io** - WebSocket temps réel

### Frontend
- **Next.js 15** - React framework avec App Router
- **TypeScript** - Typage statique
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - Composants UI modernes
- **Zustand** - State management
- **React Query** - Data fetching

### DevOps
- **Docker** - Conteneurisation
- **Turborepo** - Monorepo build system
- **GitHub Actions** - CI/CD

## 📂 Structure du Projet

\`\`\`
XNova-Reforged/
├── apps/
│   ├── api/              # Backend NestJS
│   ├── web/              # Frontend Next.js
│   └── admin/            # Admin panel (à venir)
├── packages/
│   ├── database/         # Prisma schema
│   ├── game-config/      # Configuration du jeu
│   ├── game-engine/      # Logique métier pure
│   └── ui/               # Composants UI partagés
├── docs/
│   ├── GAME_FORMULAS.md  # Formules du jeu
│   └── API.md            # Documentation API
├── docker-compose.yml
├── turbo.json
└── package.json
\`\`\`

## 🚀 Quick Start

### Prérequis

- Node.js >= 20
- npm >= 10
- Docker & Docker Compose

### Installation

\`\`\`bash
# Cloner le repo
git clone <url>
cd XNova-Reforged

# Installer les dépendances
npm install

# Démarrer les services (PostgreSQL, Redis)
npm run docker:up

# Configurer la base de données
npm run db:push

# Lancer en développement
npm run dev
\`\`\`

### URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Prisma Studio**: http://localhost:5555 (après \`npm run db:studio\`)

## 📚 Documentation

- [Roadmap MVP](../XNova - 0.8/ROADMAP_MVP.md)
- [Roadmap Complète](../XNova - 0.8/ROADMAP_COMPLET.md)
- [Stratégie d'Upgrade](../XNova - 0.8/STRATEGIE_UPGRADE.md)
- [Formules de Jeu](../XNova - 0.8/GAME_FORMULAS.md)

## 🎮 Features (MVP - 4 mois)

- [x] Authentification sécurisée (JWT)
- [ ] Gestion ressources temps réel
- [ ] Construction bâtiments
- [ ] Recherche technologies
- [ ] Système de flottes
- [ ] Combat basique
- [ ] Exploration galaxie
- [ ] Messagerie
- [ ] Alliances

## 🤝 Contribution

Ce projet est en cours de développement actif. Les contributions sont les bienvenues !

## 📄 Licence

GNU GPL v2 - Voir [LICENCE.txt](../XNova - 0.8/LICENCE.txt)

## 🙏 Crédits

Basé sur le projet original [XNova](http://www.xnova.fr/) (2008) par la XNova Team.

---

**Développé avec ❤️ en 2026**
