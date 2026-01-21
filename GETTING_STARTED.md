# Guide d'installation - XNova Reforged

## 1. Prerequis

Assurez-vous d'avoir installe :
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** et **Docker Compose**

Verifier les versions :
```bash
node --version
npm --version
docker --version
docker-compose --version
```

## 2. Recuperer le projet

```bash
git clone <url>
cd XNova-reforged
```

## 3. Installer les dependances

```bash
npm install
```

## 4. Configuration de l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env
```

Editez `.env` et adaptez les valeurs si besoin.

**Variables importantes :**
- `DATABASE_URL` : connexion PostgreSQL
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`
- `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `API_PORT`, `NEXT_PUBLIC_API_URL`

**Important :** Prisma lit `packages/database/.env`. Gardez `DATABASE_URL` coherente entre `.env` et `packages/database/.env`.

## 5. Demarrer les services Docker

```bash
# Demarrer PostgreSQL et Redis
npm run docker:up

# Verifier que les services tournent
docker ps
```

Vous devriez voir :
- `xnova-postgres` (port 5432)
- `xnova-redis` (port 6379)

## 6. Initialiser la base de donnees

Depuis la racine :
```bash
npm run db:push
```

Generer le client Prisma :
```bash
cd packages/database
npm run db:generate
cd ../..
```

(Optionnel) Ouvrir Prisma Studio :
```bash
npm run db:studio
# Disponible sur http://localhost:5555
```

## 7. Lancer le projet en mode developpement

```bash
npm run dev
```

**URLs :**
- Frontend (Next.js) : http://localhost:3000
- Backend API (NestJS) : http://localhost:3001
- Swagger (API docs) : http://localhost:3001/api/docs

## 8. Verification rapide

**Test Backend :**
```bash
curl http://localhost:3001
```

**Test Frontend :**
Ouvrir http://localhost:3000 dans votre navigateur.

---

## Commandes utiles

### Developpement

```bash
npm run dev          # Lancer tout en dev (API + Web)
npm run build        # Build de production
npm run lint         # Linter le code
npm run format       # Formater le code (Prettier)
```

### Docker

```bash
npm run docker:up    # Demarrer PostgreSQL + Redis
npm run docker:down  # Arreter les services
docker-compose logs  # Voir les logs
```

### Base de donnees

```bash
npm run db:push      # Pousser le schema Prisma
npm run db:studio    # Ouvrir Prisma Studio
cd packages/database && npm run db:migrate
```

### Tests E2E

```bash
# Installer les navigateurs Playwright si besoin
npx playwright install

# Lancer les tests E2E
npm run test:e2e
```

---

## Structure du projet

```
XNova-reforged/
├── apps/
│   ├── api/              # Backend NestJS (port 3001)
│   └── web/              # Frontend Next.js (port 3000)
├── packages/
│   ├── database/         # Prisma schema + client
│   ├── game-config/      # Configurations jeu (buildings, ships, etc.)
│   ├── game-engine/      # Logique metier pure
│   └── ui/               # Composants UI partages
├── tests/                # Tests E2E Playwright
├── docker-compose.yml    # Services Docker
├── package.json          # Root package
└── turbo.json            # Config Turborepo
```

---

## Troubleshooting

### Docker ne demarre pas

```bash
# Verifier les ports
lsof -i :5432
lsof -i :6379

# Si occupes, modifier les ports dans docker-compose.yml et .env
```

### Prisma erreurs

```bash
# Verifier la coherence de DATABASE_URL
cat .env
cat packages/database/.env

# Regenerer le client
cd packages/database
rm -rf node_modules/.prisma
npm run db:generate
```

### Hot reload ne fonctionne pas

```bash
# Tuer les processus
pkill -f "next|nest"

# Relancer
npm run dev
```

---

## Support

- Documentation : `GETTING_STARTED.md`, `ROADMAP_MVP.md`, `GAME_FORMULAS.md`
- Issues : GitHub Issues
- Discussions : GitHub Discussions
