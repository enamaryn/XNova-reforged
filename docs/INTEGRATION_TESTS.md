# 🧪 Tests d’intégration API

Les tests d’intégration (`apps/api/test/integration/**/*.spec.ts`) vérifient l’authentification, les planètes et les queues (build/research/fleet). Ils s’appuient sur une vraie base PostgreSQL + Redis pour reproduire la logique métier du backend.

## ✅ Prérequis

1. Monter les services requis :
   ```bash
   docker compose up -d postgres redis
   ```
   * Postgres 16 expose le port `5432` et Redis `6379`. Les données sont conservées via les volumes définis dans `docker-compose.yml`.
2. Copier `.env.example` vers `.env` (déjà en place dans le repo) et vérifier que `DATABASE_URL` / `REDIS_URL` pointent vers `localhost`.
3. Générer/mettre à jour le client Prisma :
   ```bash
   npx prisma generate --schema packages/database/prisma/schema.prisma
   ```
4. Initialiser la base (migrations ou `prisma db push`) :
   ```bash
   npx prisma db push --schema packages/database/prisma/schema.prisma
   ```

## 🚀 Lancer les tests

```
cd apps/api
npm run test:integration
```

Le script utilise `jest.integration.config.cjs`, qui charge `<rootDir>/test/integration/**/*.spec.ts` et applique `ts-jest` (voir `apps/api/test/integration/auth.integration.spec.ts` et `apps/api/test/integration/planets.integration.spec.ts` pour des exemples : inscription, login, lecture de planète, liste/build + annulation de la file).

## 🧵 Notes

- Les tests requièrent que l’API soit capable de se connecter à la base et à Redis via `ConfigModule.forRoot({ envFilePath: '../../.env' })`.
- Si `PrismaClientInitializationError: Can't reach database server at "localhost:5432"` apparaît, vérifier que les containers Docker sont en cours et que `DATABASE_URL` / `POSTGRES_PASSWORD` correspondent.
- Dans cet environnement d’exécution (Codex CLI sandbox), les sockets réseau sortants sont bloqués (`socket(...)` retourne `Operation not permitted`), donc les tests d’intégration ne peuvent pas se connecter à Postgres/Redis même si les containers sont démarrés. Il faut donc :
  1. Lancer les tests sur la machine de développement (ou CI) où les containers Docker sont accessibles.
  2. Reprendre les logs de `npm run test:integration` pour confirmer qu’ils passent.

## 🧰 Astuce

- Pour relancer proprement :
  ```bash
  docker compose down
  docker compose up -d postgres redis
  cd apps/api
  npm run test:integration
  ```
- Si tu préfères, tu peux utiliser `docker compose exec postgres psql` pour inspecter la base, ajouter un `player1` manuel, ou réinitialiser les tables.

Une fois ces tests verts, tu peux archiver la preuve (log, screenshot, `test-results`).
