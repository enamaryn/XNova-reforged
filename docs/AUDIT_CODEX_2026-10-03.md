# Audit complémentaire de XNova Reforged

Date : 3 octobre 2026. Dépôt : enamaryn/XNova-reforged, branche main, commit `09b31572275abf05d1db8cb834a27084c47b1b55`.

## Conclusion

Le projet possède un socle jouable, mais l'audit complémentaire révèle des défauts d'intégrité économique et de contrôle d'accès qui passent avant la finition des écrans. Je déconseille une ouverture publique avec une progression persistante avant correction et validation de ces points. Une alpha privée destinée aux essais reste un cadre possible.

Le verdict « environ 95 % terminé » n'est pas justifié par une mesure de couverture fonctionnelle. Un parcours nominal réussi et des suites vertes ne suffisent pas à garantir la sécurité entre joueurs, la conservation des ressources ou l'exécution unique des événements.

## Méthode et limites

- Lecture du compte rendu Claude fourni, identification du dépôt par le plugin GitHub et inspection d'une copie locale au commit indiqué.
- Revue croisée des services ressources, bâtiments, recherches, chantier, flottes, combat, authentification, WebSockets, galaxie, alliances, du schéma Prisma et de plusieurs tests et scripts d'exploitation.
- Exécution directe du fichier TypeScript du moteur de ressources avec Node 24.19.0, sans réécriture de sa logique : le défaut d'arrondi ci-dessous est reproduit.
- Les autres constats sont établis par lecture du code ; leurs conséquences concurrentes n'ont pas été reproduites avec PostgreSQL. Aucun essai sur une instance de production.
- Pas de nouvelle exécution du build complet, du lint, des 21 tests unitaires, des 26 tests d'intégration ou de Playwright. Les réussites rapportées par Claude restent ses résultats, pas des validations indépendantes de cet audit.
- Aucun nouveau comptage ni classement des vulnérabilités npm. Les « 103 vulnérabilités » du premier rapport ne sont pas confirmées ici et ne représentent pas nécessairement 103 vulnérabilités exploitables en production.
- Aucun changement du code audité, aucune publication GitHub, aucun déploiement. Le rapport est livré séparément ; la copie locale du dépôt est propre à la fin de la revue.

P1 signifie à corriger avant ouverture publique ; P2 signifie défaut important de fiabilité ou de gameplay. Ces priorités ne sont pas des scores CVSS.

## Constats supplémentaires

### 1. P1 — La fréquence des mises à jour peut annuler la production

**Reproduit sur le moteur réel.** Chaque calcul arrondit le stock à l'entier inférieur, puis avance `lastUpdate`. La fraction produite est définitivement perdue. À vitesse ×1, 20 métal/h représentent seulement 0,0556 métal en dix secondes.

Avec une planète sans bâtiment, initialisée à 500 métal et 500 cristal :

| Calcul sur une heure | Métal final | Cristal final |
|---|---:|---:|
| Un seul calcul après une heure | 520 | 510 |
| Un calcul toutes les dix secondes | 500 | 500 |

La barre de ressources interroge précisément l'API toutes les dix secondes, et cette lecture persiste le nouveau stock. Le cron à la minute perd également les petites fractions. L'effet varie avec la vitesse et les niveaux : ce n'est pas un blocage universel de toute production, mais un défaut déterministe aux faibles rendements.

Correction : conserver les fractions en base ou un reliquat de production ; arrondir uniquement l'affichage. Test attendu : découper une heure en 360 pas doit donner le même résultat qu'un seul pas, hors changements de niveau ou de configuration.

Sources : [moteur, L153–174 et L226–229](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/packages/game-engine/src/resources.ts#L153), [rafraîchissement persistant](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/resources/resources.service.ts#L233), [polling de la barre](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/web/components/game/layout/ResourceBar.tsx#L47).

### 2. P1 — Un rafraîchissement peut effacer une dépense ou un crédit simultané

**Constat statique ; scénario concurrent à reproduire en base.** Le service et le cron lisent un stock, calculent hors transaction, puis remplacent les valeurs absolues. Exemple : lecture de 1 000 métal, achat de 600 métal, puis écriture du calcul basé sur 1 000. Le débit de 600 disparaît. À l'inverse, une livraison intervenue entre lecture et écriture peut être perdue.

Correction : sérialiser les mutations par planète, ou utiliser un contrôle de version avec nouvelle tentative ; inclure le calcul de production dans le même mécanisme que les dépenses, crédits et combats.

Sources : [ResourcesService L233–269](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/resources/resources.service.ts#L233), [cron L66–92](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/resources/resources-cron.service.ts#L66).

### 3. P1 — Les vérifications de disponibilité précèdent les transactions

**Constat statique ; scénario concurrent à reproduire en base.** Dans `sendFleet`, les vaisseaux et ressources sont contrôlés avant la transaction qui les débite. Deux requêtes peuvent donc lire chacune dix vaisseaux disponibles et en envoyer dix chacune. Les décréments sont atomiques, mais leur condition de disponibilité ne l'est pas. Le schéma versionné ne définit pas de contrainte empêchant les quantités négatives.

Le même schéma existe pour la construction, la recherche, le chantier et la colonisation : dépassement de budget, files concurrentes ou consommation multiple d'un même colonisateur sont à tester.

Correction : verrouiller/revalider dans la transaction, ou faire des débits conditionnels atomiques et contrôler leur résultat. Une transaction regroupant seulement les écritures ne résout pas ce problème.

Sources : [flottes L100–242](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/fleet/fleet.service.ts#L100), [colonisation L138–214](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/resources/resources.service.ts#L138).

### 4. P1 — Des événements peuvent être appliqués plusieurs fois

**Constat statique ; dépend du chevauchement de traitements.** Les crons sélectionnent les éléments en attente, appliquent les effets, puis marquent l'élément terminé. Aucune prise en charge exclusive ni condition sur l'ancien état ne protège ces écritures. Deux instances de l'API peuvent sélectionner le même retour de flotte ou la même commande du chantier et créditer deux fois ses vaisseaux. Les finalisations ne sont pas idempotentes : répéter la même commande ne laisse pas le même état.

Correction : acquisition atomique de l'événement et effets dans une transaction, avec protection contre les reprises. Tester deux workers sur la même flotte et le même lot de vaisseaux. Une seule instance réduit certains déclencheurs mais ne remplace pas cette garantie.

Sources : [retours de flotte L85–146](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/fleet/fleet-cron.service.ts#L85), [finalisation chantier L282–316](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/shipyard/shipyard.service.ts#L282).

### 5. P1 — Abonnement WebSocket aux planètes d'autres joueurs

**Établi par lecture.** `handleSubscribePlanet` rejoint la room demandée sans vérifier que `client.data.userId` possède la planète. L'identifiant est exposé dans la réponse de la galaxie. Un joueur authentifié peut ainsi demander les événements de ressources et de construction d'un autre joueur.

Correction : vérifier l'appartenance avant chaque abonnement et appliquer les règles d'autorisation aux messages du socket. Tester avec deux comptes distincts. L'authentification du handshake ne suffit pas à autoriser toutes les planètes.

Sources : [abonnement L109–117](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/game-events/game-events.gateway.ts#L109), [identifiants dans la galaxie](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/galaxy/galaxy.service.ts#L79).

### 6. P1 — Le bannissement n'arrête pas une session existante

**Établi par lecture.** `login` vérifie le bannissement, mais `JwtStrategy.validate` ne charge ni `bannedAt` ni `bannedUntil`. Le refresh vérifie seulement l'existence du compte. Un joueur banni après connexion conserve donc l'accès avec ses tokens, et peut renouveler son access token tant que le refresh reste valide. Le WebSocket ne vérifie pas davantage le statut du compte.

Les durées par défaut sont sept jours pour l'access token et trente jours pour le refresh. La rotation et la révocation de sessions annoncées dans la documentation ne sont pas implémentées dans ce service.

Correction : contrôle partagé du statut du compte sur HTTP, refresh et WebSocket ; révocation/rotation des sessions ; déconnexion des sockets bannis. Test attendu : un token émis avant le bannissement doit ensuite être refusé.

Sources : [validation JWT L24–45](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/auth/strategies/jwt.strategy.ts#L24), [refresh L152–188](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/auth/auth.service.ts#L152).

### 7. P1 si multiplicateurs réduits, sinon P2 — Remboursements différents du prix payé

**Établi par lecture.** Bâtiments et recherches appliquent un multiplicateur au prix d'achat mais remboursent le prix brut à l'annulation. Les paramètres autorisent un multiplicateur de 0,1 : un coût brut de 100 est alors payé 10 et remboursé 100. Avec un multiplicateur supérieur à un, le joueur perd au contraire une partie du paiement.

Le chantier recalcule le remboursement avec le multiplicateur courant : modifier la configuration pendant une commande peut aussi changer le remboursement.

Correction : enregistrer le montant réellement débité avec l'entrée de file et rembourser ce montant. Tester les multiplicateurs inférieurs/supérieurs à un et leur modification pendant une commande.

Sources : [bâtiments, achat L196 et annulation L325](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/buildings/buildings.service.ts#L325), [recherche L238](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/research/research.service.ts#L238), [chantier L247](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/shipyard/shipyard.service.ts#L247).

### 8. P2 — Une attaque efface la cargaison déjà embarquée

**Établi par lecture.** L'envoi d'une attaque accepte du cargo et le retire de la planète. Après un combat avec survivants, `cargo: loot` remplace intégralement cette cargaison. Sur une cible existante vide et sans défense, une victoire sans butin fait donc repartir les survivants avec une cargaison vide.

Correction : définir la conservation du cargo en cas de pertes et calculer le butin selon la capacité restante, ou interdire explicitement le chargement offensif si c'est la règle voulue.

Source : [CombatService L159–170](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/combat/combat.service.ts#L159).

### 9. P2 — Le coût énergétique de Graviton n'est pas contrôlé

**Établi par lecture.** La configuration exige 300 000 d'énergie, mais `startResearch` contrôle seulement métal, cristal, deutérium et les prérequis bâtiments/technologies. Après obtention du laboratoire requis, le seuil énergétique ne bloque pas la recherche.

Correction : vérifier la condition énergétique selon la règle de jeu retenue, sans la traiter implicitement comme une ressource consommable.

Sources : [configuration Graviton L161–168](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/packages/game-config/src/technologies.ts#L161), [contrôle des coûts L144–152](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/research/research.service.ts#L144).

### 10. P1 pour la validation de sortie — Des tests verts acceptent des erreurs 500

**Établi par lecture des assertions.** Le test intitulé « envoie une flotte et la rappelle » accepte un HTTP 500 si l'envoi échoue ; le rappel n'est alors jamais testé. Plusieurs tests chantier, messages, recherches et alliances acceptent aussi des 500. Le test unitaire de combat remplace `simulateCombat`, `computeCargoCapacity` et `distributeLoot` par des mocks : il ne valide pas les calculs du moteur.

Correction : préparer des données déterministes et exiger le statut attendu, sans branche de secours validant un échec serveur. Ajouter les tests de conservation, concurrence, bannissement et isolation entre joueurs. Les nombres 21/21 et 26/26 ne prouvent donc pas tous les parcours qu'on pourrait leur attribuer.

Sources : [flottes L113–138](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/test/integration/fleet.integration.spec.ts#L113), [mocks de combat L6–10](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/test/combat.service.spec.ts#L6).

## Corrections et nuances apportées au rapport Claude

1. **Scan et colonisation existent partiellement, y compris dans l'interface.** `GET /planets/scan/:planetId` renvoie gratuitement les ressources sans condition de sonde ; `POST /planets/colonize` consomme un colonisateur et crée immédiatement une planète sans trajet. La page galaxie contient des actions branchées sur ces routes, en plus d'un autre bouton « bientôt » désactivé. Il faut distinguer ces raccourcis des missions 6/7 non traitées par le cron, puis décider des règles souhaitées. [Contrôleur](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/resources/resources.controller.ts#L29), [actions UI](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/web/app/%5Blocale%5D/%28game%29/galaxy/galaxy-client.tsx#L186).
2. **Stockage : le million de base n'exclut pas la formule exponentielle.** Le code calcule bien `1_000_000 × 1.5^niveau`. Les revenus de base sont explicitement 20/10 dans la configuration par défaut, modifiables par la configuration serveur. L'écart avec une note de session est documentaire ou une décision d'équilibrage à clarifier. [Formule](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/packages/game-engine/src/resources.ts#L189).
3. **CORS reste permissif même en production si la liste d'origines est vide.** Le problème ne dépend donc pas seulement d'un oubli de `NODE_ENV`. Cela ne constitue pas, à lui seul, une preuve de vol de compte : les routes utilisent des Bearer tokens. [Configuration](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/apps/api/src/main.ts#L18).
4. **La validation des missions a aussi `IsPositive`.** Elle manque toujours d'une liste de missions autorisées. `ships` et `cargo` ne sont validés qu'en tant qu'objets : types et bornes de leurs valeurs ainsi que les bornes supérieures des coordonnées sont aussi à renforcer. Aucune exploitation numérique n'a été reproduite ici.
5. **Le défaut de build est confirmé structurellement**, par l'import de game-config et l'absence de dépendance déclarée dans game-engine ; le build propre n'a pas été rejoué ici. Pas de configuration ESLint versionnée trouvée. Trois logs `.turbo` et un fichier `test-results` sont suivis dans ce commit, et non quatre logs `.turbo`.
6. **Le seul workflow GitHub Actions versionné est celui des sauvegardes.** Aucun workflow build/lint/tests n'a été trouvé. Cela n'exclut pas un CI externe non visible dans le dépôt. L'incompatibilité Playwright décrite par Claude concerne son environnement ; elle ne prouve pas que tous les environnements E2E échouent.
7. **La défense manque aussi dans le combat.** Le service charge les vaisseaux défenseurs, mais pas la table Defense, et inscrit `defenderDefs: {}` dans le rapport. Ajouter seulement une page et une file de construction ne suffira pas.

## Exploitation et autres contrôles à prévoir

- Le script de restauration utilise `psql` sans `ON_ERROR_STOP` et ne protège pas le pipeline avec `pipefail`. Son message de succès ne garantit pas l'absence d'erreurs SQL ou de décompression. Réaliser une restauration dans une base isolée, contrôler l'arrêt sur erreur et vérifier les données ; aucune restauration n'a été effectuée pendant cet audit. [Script](https://github.com/enamaryn/XNova-reforged/blob/09b31572275abf05d1db8cb834a27084c47b1b55/scripts/restore-db.sh#L40).
- Aucune migration Prisma versionnée trouvée : formaliser les mises à niveau et la récupération avant de stocker une progression publique durable.
- L'inscription crée le compte puis la planète hors transaction commune. Un échec de création de planète peut laisser un compte sans planète ; prévoir transaction et reprise sur collision de coordonnées.
- La configuration d'environnement n'a pas de validation explicite des deux secrets JWT au démarrage. Ne pas conclure pour autant que l'application fonctionne sans secret : la stratégie JWT peut échouer elle-même à l'initialisation. Exiger explicitement les deux secrets et tester leur absence.
- Le scan gratuit et la colonisation instantanée sont des choix fonctionnels à trancher, pas automatiquement des failles si ces règles sont voulues. Leur comportement doit être cohérent avec l'espionnage et les missions de flotte proposés aux joueurs.

## Ordre de correction recommandé

1. **Intégrité économique** : fractions de production, écritures concurrentes, disponibilités atomiques, traitement unique des événements et remboursement du montant payé.
2. **Protection des comptes et données** : autorisations WebSocket, bannissement effectif, gestion des sessions, rate limiting confirmé manquant par Claude, validation stricte des entrées.
3. **Règles de jeu** : liste des missions, déploiement, cargo de combat, énergie de Graviton, règles de scan/colonisation et intégration de la défense.
4. **Preuves de qualité** : build propre, lint configuré, workflow CI, suppression des 500 acceptés, vrais tests moteur et E2E alignés sur Playwright.
5. **Sortie MVP** : finir les écrans retenus, documenter les exclusions, valider charge, sauvegarde/restauration et mise à niveau de la base.

Critères concrets : production indépendante du découpage temporel ; aucun stock négatif sous requêtes simultanées ; aucune duplication après double traitement ; aucune donnée privée interjoueur ; token banni refusé ; remboursement égal au débit ; parcours construction/recherche/chantier/flotte/combat complet ; restauration vérifiée. Ces critères sont plus utiles qu'un pourcentage global d'avancement.
