# Exploitation — sauvegarde, restauration et migrations

Mise à jour : 4 octobre 2026 (OPS-01). Toutes les procédures ci-dessous sont couvertes par `scripts/test-backup-restore.sh`, exécuté en CI (job « Migrations, sauvegarde et restauration »).

**Règle : ne jamais tester sur la base des joueurs.** Les essais de restauration se font sur une base isolée (autre nom, idéalement autre serveur).

## Migrations versionnées

Le schéma de référence est `packages/database/prisma/schema.prisma` ; les migrations SQL versionnées sont dans `packages/database/prisma/migrations/` (migration initiale `20261004000000_init`).

| Situation | Commande |
|---|---|
| Développement : modifier le schéma puis créer la migration | `cd packages/database && npx prisma migrate dev --name <nom>` |
| Production, CI, nouvelle base : appliquer les migrations | `npm run db:migrate:deploy` (équivaut à `prisma migrate deploy`) |
| État des migrations | `cd packages/database && npx prisma migrate status` |

`npm run db:push` reste réservé au développement local jetable : il ne laisse aucune trace versionnée. **Toute modification de `schema.prisma` doit être accompagnée de sa migration** ; la CI échoue sinon (`prisma migrate diff --exit-code` sur base d'ombre).

### Base existante créée avec `db push` (une seule fois)

Les environnements déjà en service ont été créés par `db push`, sans table `_prisma_migrations`. Pour les aligner, **après une sauvegarde** :

```bash
cd packages/database
npx prisma migrate resolve --applied 20261004000000_init   # déclare la migration initiale comme déjà appliquée
npx prisma migrate deploy                                   # doit indiquer qu'aucune migration n'est en attente
```

Prérequis : la base correspond au schéma de la migration initiale (vérifiable avec `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`). Sinon, appliquer d'abord `db push` pour l'aligner, puis refaire la vérification.

### Déployer une migration

1. Sauvegarder (voir ci-dessous) et **conserver le nom du fichier produit**.
2. `npm run db:migrate:deploy`.
3. Vérifier `prisma migrate status` et le démarrage de l'API.

### Retour arrière

Prisma ne génère pas de migrations « down ». Le retour arrière se fait **par restauration de la sauvegarde prise juste avant le déploiement** :

```bash
scripts/restore-db.sh --yes backups/xnova_backup_<horodatage>.sql.gz   # base remise dans l'état d'avant, historique des migrations compris
```

Conséquence : les données écrites entre la sauvegarde et le retour arrière sont perdues. Pour les migrations destructrices (suppression de colonne ou de table), prévoir une fenêtre sans écriture (API arrêtée) entre la sauvegarde et le déploiement. Le test `test-backup-restore.sh` répète ce scénario : migration de test appliquée, restauration, colonne retirée, historique revenu à une migration, données identiques.

## Sauvegarde

```bash
DATABASE_URL=postgresql://... scripts/backup-db.sh      # écrit backups/xnova_backup_<horodatage>.sql.gz
```

- Variables : `DATABASE_URL` (obligatoire, lue aussi depuis `.env`), `BACKUP_DIR` (défaut `./backups`), `BACKUP_RETENTION_DAYS` (défaut 7).
- Le script s'arrête au premier échec (connexion, `pg_dump`, compression). L'archive est écrite sous un nom temporaire, vérifiée (`gzip -t`, fin de dump présente) puis renommée en permissions `600` : un fichier final n'existe que s'il est valide. La purge des anciennes sauvegardes n'a lieu qu'après une sauvegarde réussie.
- La sauvegarde quotidienne planifiée est `.github/workflows/backup.yml` (nécessite le secret `PROD_DATABASE_URL`).

## Restauration

```bash
scripts/restore-db.sh [--yes] <sauvegarde.sql.gz> [URL_BASE_CIBLE]
```

- Cible : argument, sinon `RESTORE_DATABASE_URL`, sinon `DATABASE_URL`. **Pour un test, toujours passer l'URL d'une base isolée.**
- Sans `--yes`, une confirmation interactive est exigée ; sans terminal, le script refuse.
- Avant d'écrire, l'archive est vérifiée (lisible, dump complet). La restauration s'exécute dans **une seule transaction** avec arrêt à la première erreur SQL : en cas d'échec, la cible reste inchangée et le code de sortie est non nul.
- Le dump contient `DROP … IF EXISTS` : la restauration remplace les objets de la cible.

## Test automatisé

```bash
TEST_PG_ADMIN_URL=postgresql://utilisateur:motdepasse@hote:5432/postgres npm run test:backup
```

Crée des bases jetables (supprimées en fin de test), puis vérifie : migrations sur base vierge sans écart avec `schema.prisma` ; alignement d'une base `db push` (baseline) ; sauvegarde valide et en permissions 600 ; restauration avec données identiques (comptes et empreinte) ; archive corrompue, tronquée, SQL invalide, fichier absent, absence de confirmation et source injoignable → échec sans effet partiel ; retour arrière d'une migration.

## Limites connues

- Les sauvegardes planifiées sont déposées comme artefacts GitHub non chiffrés (30 jours) : elles contiennent les données des joueurs et les empreintes de mots de passe ; accès limité à qui peut lire les artefacts du dépôt. Un chiffrement (GPG ou stockage externe chiffré) reste à mettre en place avant l'ouverture publique.
- Aucune restauration depuis les sauvegardes de production n'a été répétée (le test utilise des données synthétiques).
- Pas de sauvegarde continue (PITR) : la perte maximale est l'intervalle entre deux sauvegardes (24 h).
- Redis ne contient que des caches : il n'est pas sauvegardé.

## Inscriptions et confirmation d'adresse email

La confirmation de l'adresse est obligatoire pour créer un compte (`EMAIL_VERIFICATION_REQUIRED`, défaut : activée).
Avant d'ouvrir les inscriptions : configurer le SMTP (administration, onglet « Configurer SMTP », compte super admin),
envoyer un email de test, puis vérifier qu'une inscription reçoit bien son lien. Sans SMTP actif, `POST /auth/register`
répond 503 et ne crée aucun compte. `EMAIL_VERIFICATION_REQUIRED=false` est réservé au développement et aux tests.
Les comptes antérieurs à cette règle ont été marqués confirmés par la migration `20261004200000_existing_emails_considered_verified`.

## Suivi d'erreurs (Sentry)

L'intégration est **optionnelle et inactive par défaut** : sans DSN, rien n'est initialisé et aucune erreur n'est produite.
Le DSN est fourni **exclusivement par variable d'environnement** (jamais dans Git ; un test unitaire échoue si un DSN est versionné).

| Variable | Rôle |
|---|---|
| `SENTRY_DSN` | API NestJS (et serveur Next, avant `NEXT_PUBLIC_SENTRY_DSN`) |
| `NEXT_PUBLIC_SENTRY_DSN` | navigateur (DSN public) et repli du serveur Next |
| `SENTRY_ENV` / `NEXT_PUBLIC_SENTRY_ENV` | environnement (défaut : `NODE_ENV`) |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | envoi des source maps à la compilation uniquement (secret : jamais versionné) |

Côté web : `instrumentation.ts` (serveur Node et edge, `onRequestError`), `instrumentation-client.ts` (navigateur, transitions du routeur),
`app/global-error.tsx` (erreurs de rendu), tunnel `/monitoring` exclu de la redirection de langue. Côté API : `src/monitoring/sentry.ts`
(profilage chargé seulement avec un DSN ; son échec n'empêche pas le démarrage). Node ≥ 20.19 requis ; le profilage Node demande la
compilation native de `@sentry/profiling-node` (`npm ci` sans `--ignore-scripts` en production).
**À valider avant l'ouverture publique** : fournir un DSN réel dans l'environnement de production et vérifier qu'une erreur de test apparaît.

## Déploiement : procédure et vérification de l'installation

À chaque mise à jour du code sur un serveur :

```bash
git pull
npm ci                          # sans --ignore-scripts : le profilage Sentry de l'API compile un module natif
bash scripts/verify-install.sh  # Node, arbre de dépendances, versions de @sentry/nextjs, @sentry/node et next
npm run build
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma   # avec DATABASE_URL de production
sudo systemctl restart xnova-api xnova-web
```

`npm install` à la place de `npm ci`, ou l'absence de réinstallation après un `git pull`, laisse des `node_modules` différents du `package-lock.json`.
Incident du 6 octobre 2026 : le service web redémarrait en boucle (`Package subpath './config' is not defined by "exports"` dans
`@sentry/nextjs`) parce que la version installée n'était pas celle du lockfile (Sentry 11.4). `next.config.mjs` ne dépend plus du sous-chemin
`@sentry/nextjs/config` : il essaie le sous-chemin puis l'export du paquet et, à défaut, sert la configuration Next sans Sentry avec un
avertissement. Le suivi d'erreurs ne peut donc plus empêcher le site de démarrer ; `scripts/verify-install.sh` signale le décalage.
