# XNova Web (Next.js)

Frontend web pour XNova Reforged.

## Structure

\`\`\`
apps/web/
├── app/                  # Next.js App Router
│   ├── (auth)/          # Auth pages (login, register)
│   ├── (game)/          # Game pages
│   │   ├── overview/    # Planet overview
│   │   ├── buildings/   # Buildings page
│   │   ├── research/    # Research page
│   │   ├── fleet/       # Fleet management
│   │   ├── galaxy/      # Galaxy view
│   │   └── alliance/    # Alliance page
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/          # React components
│   ├── ui/             # Base UI components
│   └── game/           # Game-specific components
├── lib/                # Utilities
│   ├── api.ts          # API client
│   ├── socket.ts       # WebSocket client
│   └── store.ts        # Zustand stores
├── public/             # Static assets
│   └── assets/         # Game assets
└── styles/
\`\`\`

## Développement

\`\`\`bash
# Installer les dépendances
npm install

# Mode développement
npm run dev

# Build production
npm run build

# Lancer en production
npm run start
\`\`\`

## Accès

Frontend disponible sur http://localhost:3000
