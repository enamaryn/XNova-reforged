# Roadmap MVP — stabilisation après double audit

Mise à jour : 4 octobre 2026. **Statut : alpha privée, sortie publique non validée.**

Le socle existe et démarre sur LXC, mais aucun pourcentage global d'achèvement n'est retenu. Le [registre du double audit](docs/DOUBLE_AUDIT_2026-10.md) est la référence des constats, preuves et critères d'acceptation. La [roadmap historique](docs/history/ROADMAP_MVP_AVANT_AUDIT.md) conserve les anciens sprints ; ses cases cochées ne valent pas validation actuelle.

## Ordre de réalisation

Les travaux de sécurité et d'intégrité économique peuvent avancer en parallèle, sans attendre la finition des écrans. Attribuer chaque ID à une PR corrective et reprendre son critère d'acceptation. Une case ne passe à terminée qu'avec PR/commit et résultat de validation ; une PR documentaire ne clôture aucun défaut.

## Lot 1 — Dépendances et accès

**État : à réaliser / validation non reçue.**

- [ ] **SEC-01 (P1)** — Dépendances vulnérables. Preuve de clôture : à renseigner.
- [ ] **SEC-02 (P1)** — Autorisation WebSocket. Preuve de clôture : à renseigner.
- [ ] **SEC-03 (P1)** — Bannissement et révocation des sessions. Preuve de clôture : à renseigner.
- [ ] **SEC-04 (P1)** — Protection de connexion et configuration. Preuve de clôture : à renseigner.

## Lot 2 — Intégrité économique

**État : à réaliser / validation non reçue.**

- [~] **ECO-01 (P1)** — Conservation des fractions produites. Correctif appliqué (4 oct. 2026) : le moteur ne tronque plus le stock, arrondi à l'affichage (`floorResources`) ; 3 tests (`apps/api/test/resources-engine.spec.ts`) en échec avant, 24/24 unitaires après. Reste : lien PR/commit et test API sur PostgreSQL.
- [ ] **ECO-02 (P1)** — Écritures concurrentes de ressources. Preuve de clôture : à renseigner.
- [ ] **ECO-03 (P1)** — Disponibilités et files atomiques. Preuve de clôture : à renseigner.
- [ ] **ECO-04 (P1)** — Exécution unique des événements. Preuve de clôture : à renseigner.
- [ ] **ECO-05 (P1 conditionnel)** — Remboursement du montant réellement payé. Preuve de clôture : à renseigner.

## Lot 3 — Règles et périmètre fonctionnel

**État : à réaliser / validation non reçue.**

- [ ] **GAME-01 (P1)** — Validation des flottes et missions. Preuve de clôture : à renseigner.
- [ ] **GAME-02 (P1)** — Déploiement effectif. Preuve de clôture : à renseigner.
- [ ] **GAME-03 (P2)** — Cargo et moteur de combat. Preuve de clôture : à renseigner.
- [ ] **GAME-04 (P2)** — Recherche et énergie. Preuve de clôture : à renseigner.
- [ ] **SCOPE-01 (décision bloquante)** — Défense, scan, colonisation et comptes. Preuve de clôture : à renseigner.
- [ ] **SCOPE-02 (P2)** — Équilibrage et langues. Preuve de clôture : à renseigner.

## Lot 4 — Validation et exploitation

**État : à réaliser / validation non reçue.**

- [ ] **QUAL-01 (P1)** — Build propre, lint et CI. Preuve de clôture : à renseigner.
- [ ] **QUAL-02 (P1)** — Tests qui détectent les échecs. Preuve de clôture : à renseigner.
- [ ] **OPS-01 (P1 avant ouverture)** — Sauvegarde, restauration et migrations. Preuve de clôture : à renseigner.
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
