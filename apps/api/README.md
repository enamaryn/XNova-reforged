# XNova API (NestJS)

Backend API pour XNova Reforged.

## Structure

\`\`\`
apps/api/
├── src/
│   ├── auth/           # Authentication module
│   ├── game/           # Game logic modules
│   │   ├── resources/  # Resources management
│   │   ├── buildings/  # Buildings construction
│   │   ├── research/   # Technologies research
│   │   ├── fleet/      # Fleet management
│   │   ├── combat/     # Combat engine
│   │   └── galaxy/     # Galaxy exploration
│   ├── alliance/       # Alliance management
│   ├── messaging/      # Messages system
│   ├── common/         # Shared utilities
│   └── main.ts         # Entry point
├── test/
└── tsconfig.json
\`\`\`

## Développement

\`\`\`bash
# Installer les dépendances
npm install

# Mode développement (hot-reload)
npm run dev

# Build production
npm run build

# Lancer en production
npm run start
\`\`\`

## Environnement

Copier `.env.example` vers `.env` et configurer les variables.

## API Documentation

API docs disponibles sur http://localhost:3001/api (Swagger)
