# 🚀 Guide de Démarrage - XNova Reforged

## Étapes d'installation

### 1. Prérequis

Assurez-vous d'avoir installé :
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** et **Docker Compose**

Vérifier les versions :
```bash
node --version
npm --version
docker --version
docker-compose --version
```

### 2. Installation des dépendances

```bash
cd XNova-Reforged

# Installer toutes les dépendances (monorepo)
npm install
```

### 3. Configuration de l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env et configurer vos valeurs
nano .env
```

**Variables importantes :**
- `DATABASE_URL` : Connexion PostgreSQL
- `REDIS_URL` : Connexion Redis
- `JWT_SECRET` : Clé secrète JWT (générer une clé aléatoire sécurisée)

### 4. Démarrer les services Docker

```bash
# Démarrer PostgreSQL et Redis
npm run docker:up

# Vérifier que les services tournent
docker ps
```

Vous devriez voir :
- `xnova-postgres` (port 5432)
- `xnova-redis` (port 6379)

### 5. Initialiser la base de données

```bash
# Générer le client Prisma
cd packages/database
npx prisma generate

# Pousser le schéma vers PostgreSQL
npx prisma db push

# (Optionnel) Ouvrir Prisma Studio pour voir la DB
npx prisma studio
# Disponible sur http://localhost:5555
```

### 6. Lancer le projet en mode développement

Retourner à la racine :
```bash
cd ../..

# Lancer tous les projets (API + Web) en parallèle
npm run dev
```

**URLs :**
- Frontend (Next.js) : http://localhost:3000
- Backend API (NestJS) : http://localhost:3001

### 7. Vérification

**Test Backend :**
```bash
curl http://localhost:3001
# Devrait retourner un message ou 404 (normal, routes pas encore créées)
```

**Test Frontend :**
Ouvrir http://localhost:3000 dans votre navigateur.

---

## Commandes utiles

### Développement

```bash
npm run dev          # Lancer tout en dev (API + Web)
npm run build        # Build de production
npm run lint         # Linter le code
npm run format       # Formater le code (Prettier)
```

### Docker

```bash
npm run docker:up    # Démarrer PostgreSQL + Redis
npm run docker:down  # Arrêter les services
docker-compose logs  # Voir les logs
```

### Base de données

```bash
npm run db:push      # Pousser le schéma Prisma
npm run db:studio    # Ouvrir Prisma Studio
cd packages/database && npx prisma migrate dev  # Créer une migration
```

---

## Structure du projet

```
XNova-Reforged/
├── apps/
│   ├── api/              # Backend NestJS (port 3001)
│   └── web/              # Frontend Next.js (port 3000)
├── packages/
│   ├── database/         # Prisma schema + client
│   ├── game-config/      # Configurations jeu (buildings, ships, etc.)
│   ├── game-engine/      # Logique métier pure
│   └── ui/               # Composants UI partagés
├── docs/                 # Documentation
├── docker-compose.yml    # Services Docker
├── package.json          # Root package
└── turbo.json            # Config Turborepo
```

---

## Prochaines étapes

### Phase 1 : Authentification (Semaine 1-2)

**Backend (NestJS) :**
1. Créer le module Auth
2. Implémenter JWT strategy
3. Créer les endpoints :
   - `POST /auth/register`
   - `POST /auth/login`
   - `POST /auth/logout`
   - `GET /auth/me`

**Frontend (Next.js) :**
1. Page `/login`
2. Page `/register`
3. Gestion des tokens
4. Protected routes

**Ressources :**
- [NestJS Auth Guide](https://docs.nestjs.com/security/authentication)
- [Next.js Auth Patterns](https://nextjs.org/docs/app/building-your-application/authentication)

### Phase 2 : Ressources (Semaine 3-4)

Voir `ROADMAP_MVP.md` Sprint 3.

---

## Troubleshooting

### Docker ne démarre pas

```bash
# Vérifier les ports
lsof -i :5432
lsof -i :6379

# Si occupés, modifier les ports dans docker-compose.yml
```

### Prisma erreurs

```bash
# Régénérer le client
cd packages/database
rm -rf node_modules/.prisma
npx prisma generate
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

- 📖 Documentation : `/docs`
- 🐛 Issues : [GitHub Issues]
- 💬 Discussions : [GitHub Discussions]

---

**Bon développement ! 🚀**
