# Installation initiale dans le navigateur

L'assistant démarre **avant la base et avant la compilation de l'application**. Il est servi par Node seul : aucun `npm install`, `.env`, client Prisma ni PostgreSQL opérationnel n'est nécessaire pour afficher sa première page.

## Serveur pris en charge

Ubuntu 24.04, avec systemd actif (serveur ou conteneur LXC). Le compte qui lance la commande doit avoir les droits root pour installer les paquets, créer la base locale et enregistrer les services. Le dépôt doit être placé dans un chemin absolu simple, sans espaces, par exemple `/opt/xnova`.

Sur un serveur neuf :

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/enamaryn/XNova-reforged.git /opt/xnova
cd /opt/xnova
sudo bash scripts/install.sh
```

Le lanceur installe Node.js 22 si aucun Node compatible n'est disponible, via le dépôt signé de NodeSource, puis affiche un code temporaire. **Toutes les questions sont posées dans le navigateur**, pas dans le terminal.

## Ouvrir la première page

Le serveur d'installation écoute uniquement sur `127.0.0.1:3000`.

- Si un proxy HTTPS existant transmet votre site vers ce port, ouvrez la racine de votre site.
- Sinon, depuis votre ordinateur, ouvrez un tunnel SSH :

  ```bash
  ssh -N -L 3000:127.0.0.1:3000 root@ADRESSE_DU_SERVEUR
  ```

  Puis ouvrez `http://localhost:3000`. L'adresse saisie ensuite dans l'assistant est **l'adresse finale du serveur**, pas celle du tunnel.

Saisissez le code affiché par le lanceur. Il donne temporairement accès à l'installation système ; ne le partagez pas. Il expire après deux heures, la session après une heure. Les requêtes de préparation sont protégées par une session, un contrôle d'origine et un jeton CSRF. Un seul travail d'installation peut tourner à la fois. Les sorties brutes des commandes et les identifiants de base ne sont pas exposés par le suivi web.

Un service web existant occupant le port 3000 doit être arrêté avant le lancement. Le lanceur signale ce cas ; il n'arrête aucun service inconnu.

## Questions dans l'assistant

1. **Développement/test ou production**, puis **adresse finale du site**. La production exige HTTPS. Utiliser une origine seule, sans `/fr`, `/setup` ni port particulier.
2. **Base locale ou externe** :
   - Locale : PostgreSQL est installé ; une nouvelle base et son rôle propriétaire sont créés, avec un mot de passe aléatoire. Le nom distingue développement et production et comprend un identifiant d'installation. Aucune autre base n'est effacée.
   - Externe : saisir l'URL PostgreSQL complète. La base doit déjà exister et les credentials doivent autoriser les migrations. Aucun PostgreSQL local ni rôle local n'est créé dans ce mode. L'URL est saisie par HTTPS ou à travers le tunnel local.
3. **Accès web** :
   - HTTPS fourni par un proxy existant : conserver sa configuration et transmettre le site vers le port 3000. Next relaie `/api/*` et Socket.io vers l'API locale ; `NEXT_PUBLIC_API_URL=/api` est enregistré automatiquement.
   - HTTPS géré ici : nginx et Certbot sont installés. Le DNS doit pointer vers ce serveur et les ports 80/443 doivent être accessibles à Let's Encrypt. L'adresse email du certificat est demandée dans la page.
   - HTTP de développement : nginx est préparé sur le port 80. Une adresse HTTPS n'est pas acceptée avec ce choix.
4. Si d'anciens services `xnova-api` / `xnova-web` existent, cocher explicitement leur reprise. Leur ancienne configuration système est conservée à côté des fichiers avant remplacement. Les configurations nginx non gérées ne sont jamais écrasées.

L'assistant génère les secrets JWT, la clé de chiffrement SMTP et l'URL de la base locale. Il écrit `.env` et `.xnova-install.json` en permissions `600`, prépare le compte de service `xnova`, puis installe les dépendances en tant que ce compte. Ce compte devient propriétaire du clone ; choisissez un clone dédié au serveur. Les opérations Git ultérieures doivent utiliser ce propriétaire, par exemple `sudo -u xnova git -C /opt/xnova pull --ff-only`. Exécuter également les commandes npm/Prisma de maintenance avec ce compte, en chargeant la configuration de ce clone.

Les dépendances sont installées avec `npm ci --include=dev`, Prisma est généré et vérifié, les migrations versionnées sont appliquées avec `migrate deploy`, puis les paquets sont compilés dans l'ordre. L'installateur utilise npm 10 comme Node 22 / CI ; si le npm système appartient à une autre génération, npm 10.9.4 est préparé dans un cache privé du compte `xnova`, sans remplacer le npm système. Cela évite les faux échecs de validation des overrides observés avec npm 11. Aucune réinitialisation de base ni baseline implicite n'est exécutée, y compris pour une base externe déjà peuplée. Si elle n'a pas d'historique de migrations, utiliser la procédure de [baseline](OPERATIONS.md#base-existante-créée-avec-db-push-une-seule-fois).

## Relais vers le SMTP

La page affiche les étapes et vérifie une vraie connexion à la base via `/health`. Cliquer sur **Continuer : SMTP et compte administrateur** ferme l'écoute du service privilégié, démarre le web applicatif, attend sa réponse et ouvre `/setup`.

Le code est transmis dans un fragment d'URL, consommé puis retiré immédiatement par l'assistant applicatif. Il n'apparaît pas dans les requêtes HTTP ni dans le Referer. Il n'est pas enregistré en clair dans `.env`. Le parcours continue directement au SMTP, puis aux réglages de l'univers, à la création du super admin et à sa confirmation par email. La confirmation clôture l'installation ; les routes applicatives de configuration sont alors verrouillées comme dans le parcours existant.

La production et le développement/test utilisent tous deux le parcours SMTP réel : `EMAIL_VERIFICATION_REQUIRED=true`. Les services applicatifs restent limités à localhost. La confiance proxy générée est de 2 pour un proxy externe plus Next, et 1 pour nginx local relayant directement l'API ; adapter `TRUST_PROXY` si votre architecture comporte d'autres proxys.

## Reprise et mises à jour

En cas d'échec, le navigateur indique l'étape concernée. Les détails restent dans le terminal du lanceur ou dans `journalctl -u xnova-api -u xnova-web`. La base, ses identifiants et les clés déjà générées sont conservés. Corriger les prérequis, puis cliquer sur **Reprendre l'installation**. Une URL externe erronée, l'email Certbot et le choix de reprise des services peuvent être corrigés dans la page ; le mode, le domaine et le type de base sont figés après l'enregistrement initial.

Après un arrêt du lanceur, relancer la même commande. `.xnova-install.json` permet de reprendre sans renouveler les clés, perdre le mot de passe SMTP chiffré ou créer une autre base. Un `.env` manuel existant, une configuration incomplète ou un lien symbolique provoque un refus explicite : aucun écrasement silencieux.

Pour les mises à jour d'un serveur installé, utiliser la procédure de [déploiement](OPERATIONS.md#déploiement--procédure-et-vérification-de-linstallation). Cet assistant est un programme de première installation, pas une commande de reset. Le développement habituel Docker / `npm run dev` reste disponible et ne requiert pas cet installateur système.

## Tests

```bash
# Sans dépendances npm : fichiers de configuration, serveur HTTP, auth/CSRF,
# reprise, isolation des secrets et fermeture lors du relais.
node --test scripts/install/test/*.test.mjs

# Test PostgreSQL réel sur un conteneur dédié, avec un compte administrateur existant.
XNOVA_INSTALL_POSTGRES_CONTAINER=xnova-postgres \
XNOVA_INSTALL_POSTGRES_ADMIN=admin \
node --test scripts/install/test/*.test.mjs
```

Le test PostgreSQL crée un rôle et une base à noms aléatoires, vérifie connexion et permissions, rejoue la création, puis supprime uniquement ses propres ressources. Le test complet de première installation Ubuntu s'exécute en CI sur une machine jetable.
