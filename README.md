# XNova Reforged

Refonte moderne de XNova, un MMORPG de stratégie spatiale. Monorepo NestJS + Next.js orienté temps réel, performance et évolutivité.

## Codeur
Entièrement généré par IA, Claude et Codex.

## Statut

**Alpha privée en stabilisation ; MVP non validé pour ouverture publique.** Le double audit du 3 octobre 2026 relève des défauts de sécurité, de conservation des ressources et de fiabilité des tests.

Voir le [registre des corrections](docs/DOUBLE_AUDIT_2026-10.md) et la [roadmap MVP](ROADMAP_MVP.md) pour les priorités et critères de sortie. Le démarrage LXC et le build séquentiel sont confirmés par les journaux utilisateur ; les correctifs npm et métier ne sont pas encore validés.

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

### Installer sur un serveur LXC (Ubuntu 24.04, sans Docker)

Procédure complète pour un conteneur LXC vierge, derrière nginx, avec PostgreSQL 16 et Redis 7 installés dans le conteneur.
Exemple de domaine : `xnova.exemple.fr` (remplacer partout). Commandes à lancer en `root` sauf mention contraire.

**1. Paquets système et Node.js 22**

```bash
apt update && apt install -y git curl build-essential python3 nginx postgresql redis-server
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
node -v   # >= 20.19 requis (Node 22 recommandé)
```

**2. Base de données** (choisir un vrai mot de passe)

```bash
sudo -u postgres psql -c "CREATE ROLE xnova LOGIN PASSWORD 'MOT_DE_PASSE_FORT'"
sudo -u postgres psql -c "CREATE DATABASE xnova OWNER xnova"
systemctl enable --now postgresql redis-server
```

**3. Utilisateur et code**

```bash
adduser --disabled-password --gecos "" xnova
sudo -u xnova git clone <url-du-depot> /home/xnova/XNova-reforged
cd /home/xnova/XNova-reforged
```

**4. Configuration** : `sudo -u xnova cp .env.example .env`, puis éditer `.env` (`chmod 600 .env`). Valeurs de production minimales :

```
NODE_ENV=production
DATABASE_URL="postgresql://xnova:MOT_DE_PASSE_FORT@localhost:5432/xnova?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="<32 caractères aléatoires au moins : openssl rand -base64 48>"
JWT_REFRESH_SECRET="<un autre secret : openssl rand -base64 48>"
NEXT_PUBLIC_API_URL=/api
WEB_ORIGINS=https://xnova.exemple.fr
TRUST_PROXY=1
EMAIL_VERIFICATION_REQUIRED=true
SWAGGER_ENABLED=false
```

L'API refuse de démarrer en production si un secret manque, garde une valeur d'exemple ou si `WEB_ORIGINS` est absent.
Ne définissez pas `SETUP_TOKEN` (réservé aux tests). `NEXT_PUBLIC_API_URL` est figée à la compilation (étape 5).
Le détail des variables et du proxy : [docs/OPERATIONS.md](docs/OPERATIONS.md).

**5. Installation, migrations, compilation** (en `xnova`, avec `.env` chargé)

```bash
sudo -u xnova bash -c 'cd /home/xnova/XNova-reforged && set -a && . ./.env && set +a \
  && npm ci \
  && npx prisma generate --schema packages/database/prisma/schema.prisma \
  && bash scripts/verify-install.sh \
  && npx prisma migrate deploy --schema packages/database/prisma/schema.prisma \
  && npm run build'
```

`npm ci` (et non `npm install`) garantit les versions du `package-lock.json` ; ne pas ajouter `--ignore-scripts`.
`prisma generate` crée le client de base de données : sans lui l'API s'arrête au démarrage avec `Cannot convert undefined or null to object` (`IsEnum`).

**6. Services systemd**

```bash
cat > /etc/systemd/system/xnova-api.service <<'UNIT'
[Unit]
Description=XNova Reforged - API
After=network.target postgresql.service redis-server.service

[Service]
User=xnova
WorkingDirectory=/home/xnova/XNova-reforged/apps/api
EnvironmentFile=/home/xnova/XNova-reforged/.env
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
sed -e 's/API/Web/' -e 's#apps/api#apps/web#' -e 's/xnova-api/xnova-web/' \
  /etc/systemd/system/xnova-api.service > /etc/systemd/system/xnova-web.service
systemctl daemon-reload && systemctl enable --now xnova-api xnova-web
```

Le web écoute sur le port 3000 (variable `PORT`) et l'API sur 3001 (`API_PORT`). Vérifier : `systemctl status xnova-api xnova-web`.

**7. nginx et HTTPS** : un `server` pour `xnova.exemple.fr` avec `location / { proxy_pass http://127.0.0.1:3000; ... }` et le bloc
`location /api/` de [docs/OPERATIONS.md](docs/OPERATIONS.md) (WebSocket inclus), puis `apt install -y certbot python3-certbot-nginx && certbot --nginx -d xnova.exemple.fr`.
Si le conteneur est derrière un autre proxy, `TRUST_PROXY` doit refléter le nombre de proxys traversés.

**8. Première connexion** : lire le code d'installation dans le journal de l'API,
`journalctl -u xnova-api | grep -A3 "Code d'installation"`, puis ouvrir `https://xnova.exemple.fr/setup` (voir la section suivante).

**9. Sauvegardes** : `scripts/backup-db.sh` (sauvegarde vérifiée, rétention 7 jours), à planifier par cron/timer, et `scripts/restore-db.sh` pour restaurer ;
procédure et test dans [docs/OPERATIONS.md](docs/OPERATIONS.md).

**Mise à jour ultérieure** (`git pull`, `npm ci`, `npx prisma generate`, `scripts/verify-install.sh`, `npx prisma migrate deploy`, `npm run build`, redémarrage) : voir « Déploiement » dans [docs/OPERATIONS.md](docs/OPERATIONS.md).

### Première connexion : assistant d'installation

Un serveur neuf n'a ni super admin, ni SMTP, ni réglages : l'assistant (`/setup`) les configure à la première visite.

1. Démarrer l'API. Au démarrage, elle affiche dans son journal un **code d'installation** (`XXXX-XXXX-XXXX-XXXX`) :
   - en développement : dans le terminal de `npm run dev` ;
   - en production : `journalctl -u xnova-api | grep -A3 "Code d'installation"`.
2. Ouvrir le site : les pages de connexion et d'inscription redirigent vers `/setup`. Saisir le code (valable 2 h d'inactivité, régénéré à
   chaque redémarrage de l'API ; seule son empreinte est stockée en base).
3. Étapes : **SMTP** (enregistré puis testé par un email réel, obligatoire) → **réglages du serveur** (vitesses,
   multiplicateurs, tailles, production de base...) → **compte super admin** → **validation** : cliquer le lien reçu
   par email. Cette confirmation termine l'installation.
4. L'installation est alors **verrouillée** : les routes `/setup/*` répondent 404 et l'assistant ne peut plus être
   rouvert depuis le navigateur. Jusqu'à ce moment, les inscriptions des joueurs répondent 503.

Commandes de secours, à exécuter **sur le serveur** (après `npm run build`, variables d'environnement chargées) :

| Commande | Usage |
|---|---|
| `npm run setup:token` | Émet un nouveau code d'installation (assistant non terminé) |
| `npm run setup:reset` | Réarme l'assistant (confirmation `RESET`, ou `--yes`) ; seule façon de le relancer |
| `npm run setup:create-admin -- --username X --email Y` | Crée ou promeut un super admin, déjà confirmé (mot de passe demandé, masqué ; ou `--password-env VAR`) |
| `npm run admin:reset-password -- --username X` | Redéfinit un mot de passe et révoque les sessions |

Serveur déjà en service avant l'assistant : la migration `20261006100000_setup_completed_for_existing_installs`
le marque installé, aucun changement.

### URLs locales
- Frontend : http://localhost:3000
- API : http://localhost:3001
- Prisma Studio : http://localhost:5555 (après `npm run db:studio`)

Pour une installation détaillée : `GETTING_STARTED.md`

## Documentation

- `GETTING_STARTED.md` - Guide d'installation complet
- [Double audit et registre de corrections](docs/DOUBLE_AUDIT_2026-10.md) - Preuves, priorités, périmètres et critères d’acceptation
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
- Neuf suites d’intégration : auth, planets, research, fleet, shipyard, galaxy, messages, alliances et statistics. Leur présence ne garantit pas une couverture complète : plusieurs assertions acceptent encore des erreurs 500 (QUAL-02).
- Tests E2E : `tests/e2e/` (Playwright, interface utilisateur)
- **IMPORTANT** : Les noms d'utilisateur sont limités à 20 caractères
- Si erreur Reflector : ajouter `Reflector` aux providers du module

Le résultat 21/21 unitaires et 26/26 intégration est rapporté par Claude ; les E2E n’ont pas été exécutés dans son environnement. Le test de service combat mocke le moteur. Exécuter les tests d’intégration sur une base dédiée, jamais celle des joueurs.

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

## Limites connues de la chaîne de build

Au commit audité, `@xnova/game-engine` ne déclare pas sa dépendance à `@xnova/game-config`. Le build Turbo initial peut échouer ; le correctif durable est suivi par QUAL-01. Après installation et génération Prisma, le contournement validé sur LXC est :

```bash
npm run build --workspace=@xnova/game-config
npm run build --workspace=@xnova/game-engine
npm run build --workspace=@xnova/api
npm run build --workspace=@xnova/web
```

`npm run lint` reste une commande prévue, sans configuration ESLint versionnée au moment de l’audit. Le seul workflow GitHub Actions versionné est celui de sauvegarde.
