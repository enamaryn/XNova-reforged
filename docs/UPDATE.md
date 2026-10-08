# Mettre à jour une installation existante

Depuis le dossier du clone qui sert réellement le jeu :

```bash
sudo bash scripts/update.sh
```

Le script concerne une installation Ubuntu / LXC avec systemd, `.env` à la racine, `xnova-api` et `xnova-web`, utilisant le même compte non privilégié et les répertoires `apps/api` et `apps/web` de ce clone. Docker et les déploiements multi-instances ne sont pas pris en charge. Node doit déjà être installé ; aucun paquet système ni service n’est recréé.

Pour récupérer le script la première fois sur un ancien clone, avec le compte propriétaire du dépôt :

```bash
git pull --ff-only origin main
sudo bash scripts/update.sh
```

Même si un `git pull` a déjà récupéré le code, la commande normale effectue la sauvegarde, réinstalle et compile. `--check` affiche seulement les versions et vérifie les prérequis :

```bash
sudo bash scripts/update.sh --check
```

## Déroulement

1. Verrou exclusif : une seconde mise à jour ne peut pas tourner simultanément.
2. Vérification des services, de leur compte et de leurs chemins, de `.env`, des outils et de Node. Le dépôt doit être sur `main`, sans modification ni fichier non suivi (les fichiers ignorés comme `.env` et `backups/` sont conservés). La version distante ne doit pas suivre les configurations privées.
3. Récupération de `origin/main` ; refus d’un historique divergent. Aucune suppression ni réinitialisation Git automatique.
4. Création d’un dossier privé `backups/update-XXXXXXXX/` et copie de `.env`, `.xnova-install.json` et `packages/database/.env` quand présents. Enregistrement des commits avant/après dans `update.json`.
5. Arrêt des deux services ; sauvegarde PostgreSQL avec `backup-db.sh`, copie de l’archive vérifiée dans le dossier de reprise. La sauvegarde doit réussir avant tout remplacement du code ou des dépendances.
6. Avance rapide vers le commit fixé au précontrôle, `npm ci --include=dev`, génération Prisma, vérification de l’installation et compilation des espaces de travail dans le même ordre que l’installateur, avec le `.env` existant chargé et le web compilé en production. Les commandes du dépôt tournent avec le compte des services, pas avec root. Si npm système n’est pas de génération 10, npm 10.9.4 est utilisé via npx sans remplacer npm système.
7. Application des migrations versionnées avec `prisma migrate deploy`, sans `db push`, reset, ni baseline implicite.
8. Démarrage et contrôle de l’API (`/health/ready`, base joignable), du web (`/fr/login`) et de chacun des deux services. Le test HTTP est local ; vérifier ensuite le domaine public et HTTPS depuis un navigateur.

Les comptes, planètes, réglages, SMTP et état de l’assistant restent dans la même base. Les secrets existants sont conservés ; les définitions systemd et nginx ne sont pas modifiées. Il y a une interruption pendant la sauvegarde, la compilation et les migrations.

Les copies de configuration et l’archive ont des permissions `600`, le dossier de reprise `700`. Ils sont ignorés par Git. Les dossiers `update-*` ne sont pas purgés automatiquement : les conserver ou les archiver selon la politique du serveur. La sauvegarde normale de `backup-db.sh` garde sa rétention habituelle.

## Échec et reprise

Le script s’arrête au premier échec. En cas d’échec de sauvegarde avant toute modification, il relance uniquement les services qui étaient actifs. Après le début du changement de code, une erreur de dépendances, compilation, migration ou santé laisse les deux services arrêtés. Une interruption pendant une commande arrête également ses processus enfants, puis applique la même règle. Aucune restauration destructive n’est faite automatiquement.

Le dossier de reprise est affiché dans le terminal ; `update.json` indique l’étape, l’état et les commits. `database.sql.gz` contient les données avant les migrations, `.env` et `database.env` les configurations, `.xnova-install.json` l’état de l’installateur. Un échec avant la fin de sauvegarde peut laisser un dossier incomplet : ne pas le traiter comme une sauvegarde valide.

- **Dépendances ou compilation** : corriger la cause, puis relancer `sudo bash scripts/update.sh`. Le code peut déjà être à jour : le script recompile et sauvegarde quand même.
- **Migrations** : garder les services arrêtés et consulter l’état Prisma. Ne pas utiliser `db push` ou `migrate reset` sur la base des joueurs. Une base ancienne créée sans migrations demande la procédure de baseline documentée dans [OPERATIONS.md](OPERATIONS.md#base-existante-créée-avec-db-push-une-seule-fois), après vérification de son schéma.
- **Retour arrière nécessaire** : conserver le dossier de reprise ; arrêter les services, remettre explicitement le code au commit `previous` de `update.json`, restaurer les fichiers de configuration si nécessaire, puis la base avec `scripts/restore-db.sh <dossier>/database.sql.gz`. Réinstaller, générer Prisma et compiler cette version avant de redémarrer. Cette restauration remplace les données et demande une confirmation ; ne pas appliquer les migrations de la version abandonnée. La [procédure d’exploitation](OPERATIONS.md#retour-arrière) décrit les limites.
- **Redémarrage ou santé** : examiner `systemctl status xnova-api xnova-web` et `journalctl -u xnova-api -u xnova-web -n 100 --no-pager`. Le script ne modifie pas les ports ni les secrets pour contourner une erreur.

La commande ne remplace pas une sauvegarde hors serveur. Les essais automatisés utilisent des dépôts et des données temporaires ; ils ne doivent jamais être exécutés contre une base de joueurs.

## Vérifier le script

```bash
bash -n scripts/update.sh
npm run test:update
```

Les tests utilisent de vrais dépôts Git temporaires et simulent les commandes d’exploitation : mise à jour fast-forward, absence de changement, mode de vérification, configuration préservée, sauvegarde et permissions, refus d’un clone modifié/divergent, erreur de sauvegarde, dépendances, compilation, migration, santé et interruption. La CI les exécute avant le test natif Ubuntu, qui installe puis met réellement à jour le serveur avec PostgreSQL et systemd, et vérifie la connexion du compte administrateur ainsi que la conservation des configurations.
