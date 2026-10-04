# Double audit — registre de corrections

Mise à jour : 4 octobre 2026. Référence de code : `09b31572275abf05d1db8cb834a27084c47b1b55`.

## Sources et niveau de preuve

- **Claude, 3 octobre 2026** : compte rendu transmis par le propriétaire. Exécution annoncée : API/parcours nominaux, 21 tests unitaires et 26 d'intégration ; huit échecs initiaux non expliqués. Build échoué puis réussi, lint absent. E2E non exécutés (navigateur incompatible dans cet environnement), Docker non exécuté. Ces résultats ne sont pas des exécutions Codex.
- **Codex, 3 octobre 2026** : revue croisée du code et reproduction directe de l'arrondi de production avec Node 24.19.0. Les courses concurrentes restent à reproduire sur PostgreSQL ; les autres constats sont statiques. Aucun nouveau passage des suites complètes.
- **Journaux LXC fournis par le propriétaire** : installation Ubuntu 24.04, PostgreSQL 16, Redis 7, Node 22.23.3 ; build séquentiel réussi, 98 pages générées, services actifs et contrôles HTTP réussis. Cela ne prouve pas le build Turbo à froid ni un parcours joueur complet.
- **npm utilisateur, état reçu le 4 octobre** : 103 alertes, dont 2 critiques, 61 hautes, 37 modérées, 3 faibles (le premier compte rendu Claude indiquait 2/61 sans triage). Paquets critiques : Next.js et Handlebars. Résultat de la passe de correction non reçu ; aucun correctif considéré acquis. Le décompte évolue avec le registre et ne mesure pas directement l'exploitabilité.

Ce document est le registre des constats ; [ROADMAP_MVP.md](../ROADMAP_MVP.md) suit leur clôture. P1 = avant ouverture publique, P2 = défaut important. Ces priorités ne sont pas des scores CVSS. Une observation statique n'est pas une exploitation reproduite.

## Conclusion

Socle jouable, MVP non validé pour ouverture publique. Priorités : dépendances, contrôles d'accès, intégrité économique et qualité des preuves, avant extensions. Cette PR documente le travail ; elle ne corrige ni le code ni les dépendances.

## Registre actionnable

### SEC-01 — Dépendances vulnérables

- **Priorité :** P1. **Preuve :** npm utilisateur.
- **Constat :** 103 alertes (2 critiques, 61 hautes, 37 modérées, 3 faibles). Next.js et Handlebars critiques ; aucune preuve de correction reçue.
- **Périmètre :** `package-lock.json`, `apps/web/package.json`, `apps/api/package.json`.
- **Acceptation :** Conserver audits complets et production avant/après ; corriger les critiques/hautes de production ou documenter précisément non-applicabilité, mesure compensatoire et échéance ; traiter aussi les outils de build. Valider compilation et parcours. Ne pas appliquer aveuglément les migrations Sentry/Jest/Tailwind/Turbo ni la rétrogradation ESLint proposée.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### SEC-02 — Autorisation WebSocket

- **Priorité :** P1. **Preuve :** lecture Codex.
- **Constat :** Abonnement à une room planète sans contrôle de propriété.
- **Périmètre :** `apps/api/src/game-events/game-events.gateway.ts`.
- **Acceptation :** Avec deux comptes, refuser l'abonnement à la planète adverse ; aucun événement privé reçu ; abonnement propriétaire conservé.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### SEC-03 — Bannissement et révocation des sessions

- **Priorité :** P1. **Preuve :** lecture Codex.
- **Constat :** Login vérifie le ban ; JWT existants, refresh et sockets ne le font pas. Logout ne révoque pas de session serveur.
- **Périmètre :** `apps/api/src/auth/strategies/jwt.strategy.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/game-events/game-events.gateway.ts`.
- **Acceptation :** Un token émis avant le ban est refusé ensuite sur HTTP/refresh ; socket déconnecté ; définir et tester rotation, expiration et révocation/logout.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### SEC-04 — Protection de connexion et configuration

- **Priorité :** P1. **Preuve :** exécution Claude + lecture Codex.
- **Constat :** 15 échecs login sans limitation ; CORS ouvert si origines absentes même en production ; validation explicite des secrets absente.
- **Périmètre :** `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/auth`, `apps/api/src/game-events/game-events.gateway.ts`.
- **Acceptation :** Limiter login/register selon une politique testée (429 puis récupération) ; exiger les secrets et origines de production ; tester en-têtes de sécurité. Évaluer CSRF selon le transport réel des credentials, sans assimiler CORS à une authentification.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### ECO-01 — Conservation des fractions produites

- **Priorité :** P1. **Preuve :** reproduit Codex.
- **Constat :** À vitesse ×1, 360 pas de 10 s laissent 500/500 au lieu de 520/510 sur une heure.
- **Périmètre :** `packages/game-engine/src/resources.ts`, `apps/api/src/resources/resources.service.ts`.
- **Acceptation :** Conserver fractions/reliquat ; même résultat pour une heure calculée en un pas ou 360 pas, à niveaux/configuration constants ; test de l'API interrogée fréquemment.
- **État :** correctif appliqué le 4 octobre 2026 (stock non tronqué, arrondi à l'affichage) ; tests moteur en échec avant, réussis après. Clôture en attente : lien PR/commit et test API sur PostgreSQL.

### ECO-02 — Écritures concurrentes de ressources

- **Priorité :** P1. **Preuve :** lecture Codex ; reproduction DB requise.
- **Constat :** Refresh/cron réécrivent un stock absolu et peuvent écraser un débit ou un crédit concurrent.
- **Périmètre :** `apps/api/src/resources/resources.service.ts`, `apps/api/src/resources/resources-cron.service.ts`.
- **Acceptation :** Test PostgreSQL entre refresh, achat et livraison : bilan initial + production + crédits − débits conservé ; stratégie transactionnelle/verrou/version commune à toutes les mutations.
- **État :** correctif appliqué le 4 octobre 2026 (delta + verrou optimiste sur `lastUpdate`, partagé par l'API et les deux crons) ; test PostgreSQL refresh/débit/crédit concurrents en échec avant, réussi après. Limite : plafond de stockage évalué sur l'instantané lu ; achat/livraison/butin non retestés individuellement. Clôture en attente : lien PR/commit.

### ECO-03 — Disponibilités et files atomiques

- **Priorité :** P1. **Preuve :** lecture Codex ; reproduction DB requise.
- **Constat :** Contrôles de ressources, vaisseaux, files et colonisateurs effectués avant les transactions.
- **Périmètre :** `apps/api/src/fleet/fleet.service.ts`, `apps/api/src/buildings/buildings.service.ts`, `apps/api/src/research/research.service.ts`, `apps/api/src/shipyard/shipyard.service.ts`, `apps/api/src/resources/resources.service.ts`.
- **Acceptation :** Requêtes simultanées avec budget limité : aucun stock négatif, aucun double usage d'un vaisseau/colonisateur, quotas et unicité des files respectés ; vérifier annulation contre finalisation.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### ECO-04 — Exécution unique des événements

- **Priorité :** P1. **Preuve :** lecture Codex ; reproduction multiworker requise.
- **Constat :** Finalisations et retours non protégés contre une sélection concurrente du même événement.
- **Périmètre :** `apps/api/src/fleet/fleet-cron.service.ts`, `apps/api/src/shipyard/shipyard.service.ts`, `apps/api/src/buildings/buildings.service.ts`, `apps/api/src/research/research.service.ts`, `apps/api/src/combat/combat.service.ts`.
- **Acceptation :** Deux workers et une reprise traitent le même événement sans double crédit, double rapport ni double incrément ; effets et prise en charge atomiques.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### ECO-05 — Remboursement du montant réellement payé

- **Priorité :** P1 conditionnel. **Preuve :** lecture Codex.
- **Constat :** Bâtiments/recherches remboursent le coût brut ; chantier utilise le multiplicateur courant.
- **Périmètre :** `apps/api/src/buildings/buildings.service.ts`, `apps/api/src/research/research.service.ts`, `apps/api/src/shipyard/shipyard.service.ts`.
- **Acceptation :** Enregistrer les coûts débités ; annulation rembourse exactement ces coûts pour multiplicateurs 0,1/1/>1 et après changement de configuration. Priorité P1 si coûts réduits, sinon P2.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### GAME-01 — Validation des flottes et missions

- **Priorité :** P1. **Preuve :** exécution Claude + lecture Codex.
- **Constat :** Missions 6/7/999 acceptées sans effet ; IsInt/IsPositive ne constituent pas une liste autorisée ; objets cargo/ships peu validés.
- **Périmètre :** `apps/api/src/fleet/dto/send-fleet.dto.ts`, `apps/api/src/fleet/fleet.service.ts`, `apps/api/src/fleet/fleet-cron.service.ts`.
- **Acceptation :** Liste de missions réellement implémentées commune UI/API ; refuser missions inconnues sans débit ; nombres finis, quantités entières de vaisseaux, coordonnées bornées et règles de cible testés.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### GAME-02 — Déploiement effectif

- **Priorité :** P1. **Preuve :** lecture des deux audits.
- **Constat :** DEPLOY livre puis revient comme un transport.
- **Périmètre :** `apps/api/src/fleet/fleet-cron.service.ts`.
- **Acceptation :** Définir destination autorisée ; vaisseaux et cargo transférés une fois, aucun retour ; transport et rappel restent fonctionnels.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### GAME-03 — Cargo et moteur de combat

- **Priorité :** P2. **Preuve :** lecture Codex.
- **Constat :** Cargo embarqué remplacé par le butin ; tests de service mockent le moteur.
- **Périmètre :** `apps/api/src/combat/combat.service.ts`, `apps/api/test/combat.service.spec.ts`, `packages/game-engine/src`.
- **Acceptation :** Définir pertes de cargo, conserver le reste et limiter butin à la capacité libre ; tester moteur réel et combat API avec retour, pertes et rapport.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### GAME-04 — Recherche et énergie

- **Priorité :** P2. **Preuve :** lecture des deux audits.
- **Constat :** Bouton détail inactif ; seuil énergétique de Graviton non vérifié.
- **Périmètre :** `apps/api/src/research/research.service.ts`, `packages/game-config/src/technologies.ts`, `apps/web/app/[locale]/(game)/research/[techId]/ResearchDetailClient.tsx`.
- **Acceptation :** Graviton refusé sous le seuil et autorisé au seuil avec prérequis ; recherche détail démarrée/finalisée et niveau visible.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### SCOPE-01 — Défense, scan, colonisation et comptes

- **Priorité :** décision bloquante. **Preuve :** lecture des deux audits.
- **Constat :** Défense absente du jeu et du combat ; scan gratuit et colonisation instantanée existent via routes/UI, missions correspondantes incomplètes ; paramètres et récupération de compte partiels.
- **Périmètre :** `apps/api/src/resources/resources.controller.ts`, `apps/api/src/resources/resources.service.ts`, `apps/api/src/combat/combat.service.ts`, `apps/web/app/[locale]/(game)/galaxy/galaxy-client.tsx`.
- **Acceptation :** Décider explicitement ce qui entre au MVP ; chaque fonction retenue doit avoir API/UI/tests ; toute exclusion doit retirer les actions trompeuses et être documentée. Défense retenue : construction ET participation au combat ; scan/colonisation : coût, délai, règles et missions cohérents.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### SCOPE-02 — Équilibrage et langues

- **Priorité :** P2. **Preuve :** lecture des deux audits.
- **Constat :** Notes divergentes et libellés non traduits ; défauts de calcul à distinguer des décisions de règles.
- **Périmètre :** `apps/api/src/server-config/server-config.service.ts`, `packages/game-engine/src/resources.ts`, `docs/BALANCE.md`, `apps/web/i18n/messages`.
- **Acceptation :** Documenter valeurs par défaut et valeurs serveur, vitesses et stockage exponentiel 1 000 000 × 1,5^niveau ; valider progression ; parcourir les langues annoncées.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### QUAL-01 — Build propre, lint et CI

- **Priorité :** P1. **Preuve :** exécution Claude + lecture Codex.
- **Constat :** game-engine importe game-config sans dépendance déclarée ; configuration ESLint absente ; seul workflow versionné : backup.
- **Périmètre :** `packages/game-engine/package.json`, `turbo.json`, `.github/workflows`, `package.json`.
- **Acceptation :** Sur clone vierge : npm ci, génération Prisma, premier npm run build et npm run lint réussissent ; CI exécute contrôles et tests ; artefacts .turbo/test-results retirés du suivi sans supprimer leurs règles ignore.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### QUAL-02 — Tests qui détectent les échecs

- **Priorité :** P1. **Preuve :** lecture Codex + résultats Claude.
- **Constat :** Certaines assertions acceptent 500 ; huit échecs initiaux inexpliqués ; E2E non exécutés dans l'environnement Claude.
- **Périmètre :** `apps/api/test/integration`, `apps/api/test/combat.service.spec.ts`, `playwright.config.ts`, `tests/e2e`.
- **Acceptation :** Scénarios nominaux exigent succès exact et toutes leurs étapes ; aucun 500 accepté pour prouver un rejet métier ; données déterministes, tests sur base dédiée vierge répétés ; navigateur aligné sur lockfile ; E2E et tests des corrections passent en CI.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### OPS-01 — Sauvegarde, restauration et migrations

- **Priorité :** P1 avant ouverture. **Preuve :** lecture Codex ; exécution requise.
- **Constat :** Scripts présents mais restauration sans arrêt strict sur erreur SQL/pipeline ; pas de migrations versionnées trouvées.
- **Périmètre :** `scripts/backup-db.sh`, `scripts/restore-db.sh`, `.github/workflows/backup.yml`, `packages/database/prisma/schema.prisma`, `.gitignore`.
- **Acceptation :** Backup restauré sur base isolée et données vérifiées ; erreurs SQL/décompression provoquent échec ; migrations versionnées et procédure de rollback répétée. Ne jamais utiliser la base joueurs pour les tests.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### OPS-02 — Inscription atomique

- **Priorité :** P2. **Preuve :** lecture Codex.
- **Constat :** Compte puis planète créés séparément ; collision/erreur peut laisser un compte sans planète.
- **Périmètre :** `apps/api/src/auth/auth.service.ts`.
- **Acceptation :** Échec injecté de création planète : aucune inscription partielle ; collisions de coordonnées reprises de façon bornée.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

### OPS-03 — Charge et parcours complet

- **Priorité :** validation sortie. **Preuve :** non vérifié.
- **Constat :** 100 joueurs, latences, uptime, couverture et Lighthouse étaient des objectifs présentés comme acquis.
- **Périmètre :** `ROADMAP_MVP.md`, `docs/INTEGRATION_TESTS.md`.
- **Acceptation :** Rapport daté avec matériel, configuration, données, durée, p50/p95/p99 et erreurs ; seuils définis avant essai ; parcours joueur complet et sauvegarde/rollback validés.
- **État :** ouvert ; responsable à attribuer lors de la PR corrective. Clôture : lien PR/commit + test et résultat requis.

## Nuances à conserver

- Scan et colonisation ont des routes et actions UI fonctionnellement branchées ; ne pas les déclarer totalement absents. Les missions 6/7 ne sont pas résolues par le cron.
- Stockage initial d'un million et croissance exponentielle ne se contredisent pas. Les revenus par défaut 20/10 sont explicitement configurés ; les réglages LXC diffèrent de la vitesse ×1 utilisée pour reproduire l'arrondi.
- CORS accepte toute origine si la liste est vide même avec NODE_ENV=production ; cela ne prouve pas seul un vol de compte. L'absence de validation explicite des secrets ne prouve pas que l'API démarre sans secret.
- Trois logs .turbo et un fichier test-results sont suivis dans le commit audité, et non quatre logs .turbo.
- L'absence de CI versionné n'exclut pas un service externe non visible. L'échec Playwright propre à un environnement n'est pas une preuve d'échec universel.

## Procédure de correction des dépendances

Conserver le lockfile et les manifestes avant modification ; enregistrer `npm audit --include=dev --json` et `npm audit --omit=dev --json` (code non nul attendu si alertes). Appliquer d'abord les corrections compatibles, examiner le diff, reconstruire et tester. Traiter les migrations majeures dans des PR séparées ; ne pas utiliser `--force` comme preuve de sécurité ni rétrograder eslint-config-next 15 vers 14 sans analyse. Ne jamais joindre .env, dumps ou secrets aux rapports publics. Clôturer SEC-01 seulement après audit post-correction et preuve de validation.

## Preuves techniques complémentaires

Voir le [rapport détaillé Codex](AUDIT_CODEX_2026-10-03.md) pour les références GitHub figées et les scénarios de reproduction. Les tests de concurrence, de charge et de restauration restent explicitement à exécuter.
