# Roadmap MVP — stabilisation après double audit

Mise à jour : 4 octobre 2026. **Statut : alpha privée, sortie publique non validée.**

Le socle existe et démarre sur LXC, mais aucun pourcentage global d'achèvement n'est retenu. Le [registre du double audit](docs/DOUBLE_AUDIT_2026-10.md) est la référence des constats, preuves et critères d'acceptation. La [roadmap historique](docs/history/ROADMAP_MVP_AVANT_AUDIT.md) conserve les anciens sprints ; ses cases cochées ne valent pas validation actuelle.

## Ordre de réalisation

Les travaux de sécurité et d'intégrité économique peuvent avancer en parallèle, sans attendre la finition des écrans. Attribuer chaque ID à une PR corrective et reprendre son critère d'acceptation. Une case ne passe à terminée qu'avec PR/commit et résultat de validation ; une PR documentaire ne clôture aucun défaut.

## Lot 1 — Dépendances et accès

**État : à réaliser / validation non reçue.**

- [~] **SEC-01 (P1)** — Dépendances vulnérables. Correctif partiel appliqué (4 oct. 2026) : `npm audit fix` sans `--force` (lockfile seul) ; 103 → 72 alertes, 0 critique (production : 60 → 34, 0 critique, 9 hautes). Rapports avant/après dans `docs/audits/`, analyse dans `docs/NPM_AUDIT_2026-10.md`. Build séquentiel, 35/35 unitaires et 62/62 intégration en local. **Reste** : 9 hautes de production (chaîne `@sentry/nextjs` ≤ 10.39, `postcss` imbriqué dans Next, `picomatch`) sans mesure de clôture, migration Sentry 11 à planifier ; lien PR/commit ; audit en CI (QUAL-01).
- [~] **SEC-02 (P1)** — Autorisation WebSocket. Correctif appliqué (4 oct. 2026) : `subscribe:planet` vérifie en base que la planète appartient au socket authentifié, sinon événement `subscribe:refused` (même réponse pour planète absente ou adverse) ; test avec deux comptes et vrais sockets (`ws-planet-subscription.integration.spec.ts`) : échec avant, réussite après ; intégration 51/51 en local. Reste : lien PR/commit ; SEC-03 (jeton révoqué/banni sur sockets) non traité.
- [~] **SEC-03 (P1)** — Bannissement et révocation des sessions. Correctif appliqué (4 oct. 2026) : table `Session` (claim `sid` dans les JWT), contrôle session + bannissement à chaque requête, refresh token à usage unique avec rotation et détection de rejeu, déconnexion qui révoque la session et coupe les sockets, ban qui révoque les sessions et coupe les sockets, contrôle à la connexion WebSocket. 6 tests PostgreSQL (`sec03-sessions.integration.spec.ts`) en échec avant, réussite après ; intégration 57/57 en local. Reste : lien PR/commit ; `db push` sur les environnements ; migration versionnée (OPS-01) ; durée de vie de l'access token (SEC-04).
- [~] **SEC-04 (P1)** — Protection de connexion et configuration. Correctif appliqué (4 oct. 2026) : limitation login/register (429 + `Retry-After`, récupération après fenêtre ; par IP et, pour le login, par compte visé), démarrage refusé en production sans secrets valides ni `WEB_ORIGINS`, CORS HTTP et WebSocket jamais ouverts en production, en-têtes de sécurité. 15 tests unitaires et 5 d'intégration en échec avant ou ajoutés ; intégration 62/62 en local. Reste : lien PR/commit ; limiteur en mémoire (une instance) ; durée de l'access token ; cookie `xnova_access` du web sans `Secure`/`HttpOnly`.

## Lot 2 — Intégrité économique

**État : à réaliser / validation non reçue.**

- [~] **ECO-01 (P1)** — Conservation des fractions produites. Correctif appliqué (4 oct. 2026) : le moteur ne tronque plus le stock, arrondi à l'affichage (`floorResources`) ; 3 tests (`apps/api/test/resources-engine.spec.ts`) en échec avant, 24/24 unitaires après. Reste : lien PR/commit et test API sur PostgreSQL.
- [~] **ECO-02 (P1)** — Écritures concurrentes de ressources. Correctif appliqué (4 oct. 2026) : le refresh API/cron applique la production en delta (`increment`) avec verrou optimiste sur `lastUpdate` (`resource-refresh.ts`). Test PostgreSQL `resources-concurrency.integration.spec.ts` : échec avant, réussite après ; intégration 28/28 sur base vierge locale. Reste : lien PR/commit ; achat/livraison/butin utilisaient déjà des incréments atomiques (contrôles de disponibilité = ECO-03).
- [~] **ECO-03 (P1)** — Disponibilités et files atomiques. Correctif appliqué (4 oct. 2026) : verrou de ligne (`FOR UPDATE`) planète/utilisateur, débits conditionnels (ressources, vaisseaux, colonisateur), files et quotas revérifiés dans la transaction, annulation et finalisation par prise en charge atomique (`src/common/atomic.ts`). 6 tests PostgreSQL concurrents (`eco03-atomicity.integration.spec.ts`) en échec avant, réussis après ; unitaires 25/25, intégration 34/34 en local. Reste : lien PR/commit ; finalisation des flottes et combats = ECO-04.
- [~] **ECO-04 (P1)** — Exécution unique des événements. Correctif appliqué (4 oct. 2026) : arrivées, retours et combats prennent la flotte en charge par `updateMany` conditionné sur le statut ; combat résolu dans une transaction (verrou cible, butin borné au stock réel, pertes en décrément) ; rappel atomique ; finalisations de files protégées dès ECO-03. 6 tests PostgreSQL à deux workers (`eco04-single-execution.integration.spec.ts`) ; les 3 tests de flotte échouent avant correction ; unitaires 25/25, intégration 40/40 en local. Reste : lien PR/commit ; reprise après crash en cours de traitement non testée.
- [~] **ECO-05 (P1 conditionnel)** — Remboursement du montant réellement payé. Correctif appliqué (4 oct. 2026) : champ `paidCost Json?` sur `BuildQueue`/`ResearchQueue`/`ShipQueue` (schéma Prisma, `db push`), enregistré au débit et remboursé tel quel à l'annulation ; repli sur l'ancien calcul pour les entrées sans coût. 10 tests PostgreSQL (multiplicateurs 0,1/1/2,5, config changée à 7 avant annulation) : 7 échecs avant, réussite après ; unitaires 25/25, intégration 50/50 en local. Reste : lien PR/commit ; migration versionnée (OPS-01) ; remboursement de repli approximatif pour les entrées existantes.

## Lot 3 — Règles et périmètre fonctionnel

**État : à réaliser / validation non reçue.**

- [~] **GAME-01 (P1)** — Validation des flottes et missions. Correctif appliqué (4 oct. 2026) : liste commune `IMPLEMENTED_MISSIONS` (attaque, transport, déploiement) appliquée à l'API (`@IsIn` + service) et à l'UI (espionnage/colonisation retirés du formulaire) ; coordonnées bornées, vaisseaux et cargaison entiers validés, règles de cible (origine, attaque, transport, déploiement) ; refus sans débit. 40 tests (`game01-fleet-validation.integration.spec.ts`), dont 18 en échec avant correctif ; intégration 102/102 et unitaires 35/35 en local ; tests de flotte existants durcis (plus d'acceptation d'un 500). Reste : lien PR/commit ; règle de déploiement définitive (GAME-02) ; espionnage/colonisation (SCOPE-01).
- [~] **GAME-02 (P1)** — Déploiement effectif. Correctif appliqué (4 oct. 2026) : à l'arrivée, vaisseaux et cargaison sont transférés une seule fois sur la planète de destination du joueur et la flotte passe à `completed` (aucun retour) ; si la destination n'est plus une planète du joueur, la flotte rentre avec son contenu ; transport et rappel inchangés. 5 tests PostgreSQL (`game02-deploy.integration.spec.ts`), dont 3 en échec avant correctif ; intégration 107/107 et unitaires 35/35 en local. Reste : lien PR/commit ; règle de destination à confirmer (SCOPE-01) ; absence de capacité maximale d'accueil.
- [~] **GAME-03 (P2)** — Cargo et moteur de combat. Correctif appliqué (4 oct. 2026) selon la règle du propriétaire : le butin n'est embarqué que dans la place restante des vaisseaux survivants du vainqueur, le reste n'est pas emporté ; la cargaison déjà embarquée est conservée dans la limite de cette capacité (surplus perdu, tout perdu si la flotte est détruite). `fitCargo` ajouté au moteur ; 9 tests moteur réel (`combat-cargo.spec.ts`) et 4 tests de combat complet via le cron (`game03-combat-cargo.integration.spec.ts`) ; 2 de ces 4 échouent avant correctif ; unitaires 44/44, intégration 111/111 en local. Reste : lien PR/commit ; sort du reliquat de butin non emporté (laissé à la cible) à confirmer ; pertes de cargo non détaillées dans le rapport.
- [~] **GAME-04 (P2)** — Recherche et énergie. Correctif appliqué (4 oct. 2026) : le seuil d'énergie du Graviton (300 000, énergie produite par les bâtiments, non consommée) est vérifié avant tout débit (400 « Energie insuffisante ») et exposé dans la liste (`energyRequired`, `energyAvailable`, `hasEnoughEnergy`, `canResearch`) ; le bouton de la page détail lance désormais la recherche (état réel, prérequis, énergie, erreurs). 4 tests PostgreSQL (`game04-research-energy.integration.spec.ts`, frontière N-1/N) en échec avant correctif ; unitaires 44/44, intégration 115/115 en local ; builds API et web réussis. Reste : lien PR/commit ; règle d'énergie (produite brute vs nette) à confirmer ; parcours navigateur du bouton non testé ; Graviton coûte 0 ressource donc dure 1 s.
- [ ] **SCOPE-01 (décision bloquante)** — Défense, scan, colonisation et comptes. Preuve de clôture : à renseigner.
- [ ] **SCOPE-02 (P2)** — Équilibrage et langues. Preuve de clôture : à renseigner.

## Lot 4 — Validation et exploitation

**État : à réaliser / validation non reçue.**

- [~] **QUAL-01 (P1)** — Build propre, lint et CI. Correctif appliqué (4 oct. 2026) : `game-engine` déclare `@xnova/game-config`, `web` déclare `@xnova/game-engine`, `database` a un `build` (prisma generate, hors cache Turbo) ; scripts compilés obsolètes retirés ; ESLint configuré (racine + web), 0 erreur / 105 avertissements ; `.github/workflows/ci.yml` (build, lint, unitaires, intégration PostgreSQL, audit de production critiques) ; journaux `.turbo` retirés du suivi ; défaut de démarrage corrigé (semis de la galaxie en concurrence). Preuve sur **clone vierge local** (npm ci, build Turbo à froid 5/5, lint, 44/44 unitaires, 116/116 intégration sur 5 bases neuves consécutives). Première exécution du workflow sur GitHub : verte (PR #10). Reste : lien PR/commit ; E2E hors CI ; seuil d'audit « hautes » ; avertissements ESLint (dette).
- [~] **QUAL-02 (P1)** — Tests qui détectent les échecs. Correctif appliqué (4 oct. 2026) : plus aucune assertion n'accepte un 500 ni une liste de statuts (alliances, galaxie, messagerie, recherche, chantier) ; scénario nominal du chantier exige 201 et toutes ses étapes ; comptes de test sans collision (`buildTestUser` à aléa cryptographique) ; E2E exécutés pour la première fois : 15/15 sur production + base vierge après correction de 4 défauts applicatifs et de 2 tests ; job E2E ajouté à la CI. Intégration 116/116 sur 3 bases neuves, E2E 12 passes consécutives. Reste : lien PR/commit ; première exécution du job E2E sur GitHub ; moteur de combat toujours mocké dans `combat.service.spec.ts` (couvert par les tests GAME-03) ; E2E limités à 15 parcours.
- [~] **OPS-01 (P1 avant ouverture)** — Sauvegarde, restauration et migrations. Correctif appliqué (4 oct. 2026) : migration initiale versionnée (`20261004000000_init`) et alignement des bases `db push` par baseline ; `backup-db.sh` atomique et vérifié ; `restore-db.sh` tout ou rien (transaction unique, `ON_ERROR_STOP`, archive vérifiée, confirmation) ; test `scripts/test-backup-restore.sh` (28 contrôles : restauration avec données identiques, 8 scénarios d'échec sans effet partiel, retour arrière d'une migration) exécuté en CI ; contrôle d'écart schéma/migrations en CI ; tests d'intégration et E2E sur le schéma issu des migrations. Procédures dans `docs/OPERATIONS.md`. Reste : lien PR/commit ; sauvegardes planifiées non chiffrées (artefacts GitHub) ; restauration jamais répétée sur une vraie sauvegarde de production ; `db push` à remplacer par `migrate deploy` sur les environnements existants (baseline à exécuter).
- [ ] **OPS-02 (P2)** — Inscription atomique. Preuve de clôture : à renseigner.
- [ ] **OPS-03 (validation sortie)** — Charge et parcours complet. Preuve de clôture : à renseigner.

## Décisions de périmètre requises

- [ ] Défense : incluse avec API, UI et résolution des combats, ou explicitement exclue et retirée des actions proposées.
- [ ] Espionnage et colonisation : missions avec coûts/délais ou raccourcis assumés ; aligner les routes existantes, l'UI et le guide joueur.
- [ ] Compte : définir mot de passe oublié, changement email/mot de passe et vérification email ; ne pas annoncer de parcours inachevé.
- [ ] Équilibrage : fixer vitesses, revenus de base, coûts et stockage ; documenter les paramètres réellement testés.

Ces décisions ne sont pas prises par cette PR ; une exclusion n'autorise pas à laisser une mission silencieusement sans effet.

## Critères de sortie obligatoires

- [ ] SEC-01 à SEC-04 validés ; aucune critique/haute de production non traitée sans analyse explicite et mesure compensatoire acceptée ; suivi des alertes build/dev conservé.
- [ ] ECO-01 à ECO-05 validés : bilan des stocks conservé, aucun stock négatif, aucune duplication sous concurrence ou reprise.
- [ ] GAME-01 à GAME-04 validés ; toutes les fonctions retenues dans SCOPE-01 accessibles et testées ; exclusions annoncées clairement.
- [ ] Clone vierge : installation verrouillée, génération Prisma, premier build, lint et suites CI réussis (QUAL-01/02).
- [ ] Tests intégration sur base dédiée vierge, statuts précis et aucun 500 accepté comme succès métier ; E2E réellement exécutés.
- [ ] Parcours joueur : inscription, connexion, production, construction, recherche, chantier, transport/déploiement/attaque, rapport/retour, social et refus d'accès interjoueur.
- [ ] Restauration isolée et retour arrière répétés ; migrations versionnées (OPS-01).
- [ ] Charge mesurée pour au moins 100 joueurs simulés ; protocole, matériel, durée, jeu de données et p50/p95/p99 publiés. Fixer les seuils API/WebSocket avant exécution.
- [ ] Objectifs historiques couverture >70 %, Lighthouse >90 et uptime >99 % mesurés ou révisés explicitement avec justification ; aucun résultat supposé acquis.
- [ ] Documentation README, guide joueur, endpoints et configuration synchronisée avec le périmètre livré.

## État des vérifications disponibles

| Vérification | Preuve disponible | Limite |
|---|---|---|
| Build | Claude : échec initial puis réussite ; LXC utilisateur : compilation séquentielle réussie | Ordonnancement Turbo à froid non corrigé |
| Unitaires | Claude : 21/21 | Moteur de combat mocké dans test de service |
| Intégration | Claude : 26/26 après huit échecs initiaux | Certains tests acceptent 500 ; cause initiale inconnue |
| E2E | Fichiers présents | Non exécutés dans l'environnement Claude |
| Production fractionnaire | Codex : défaut reproduit sur moteur | Correction et test API restent à faire |
| Installation LXC | Journaux utilisateur : API/web actifs, PostgreSQL/Redis et HTTP OK | Ne prouve pas sécurité, charge ou parcours complet |
| npm | Utilisateur : 103 alertes dont 2 critiques | Rapport après correction non reçu |

## Historique et extensions

Les sprints de janvier restent archivés pour préserver les réalisations. Les extensions de [ROADMAP_COMPLET.md](ROADMAP_COMPLET.md) attendent les critères de sortie ci-dessus ; les correctifs de sécurité et de conservation des ressources ne sont pas reportés au post-MVP.
