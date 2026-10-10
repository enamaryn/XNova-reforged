# Audit npm — SEC-01 (4 octobre 2026)

Rapports bruts conservés dans [`docs/audits/`](audits/) : `npm-audit-before-full.json`, `npm-audit-before-prod.json`, `npm-audit-after-full.json`, `npm-audit-after-prod.json` (sorties de `npm audit --json` avec et sans `--omit=dev`, sur Node 22.22.0).

## Résultat

| Périmètre | Avant | Après |
|---|---|---|
| Complet (dev + prod) | 103 — 2 critiques, 61 hautes, 37 modérées, 3 faibles | 72 — **0 critique**, 42 hautes, 30 modérées, 0 faible |
| Production (`--omit=dev`) | 60 — 1 critique, 26 hautes, 31 modérées, 2 faibles | 34 — **0 critique**, 9 hautes, 25 modérées, 0 faible |

Action : `npm audit fix --ignore-scripts` (sans `--force`). Seul `package-lock.json` change ; aucun `package.json` modifié, aucune montée de version majeure. Versions notables après correction : Next.js 15.5.9 → 15.5.27, `@nestjs/core` et `@nestjs/platform-express` 11.1.12 → 11.2.7, Handlebars 4.7.8 → 4.7.9.

- **Critique Next.js (production)** : corrigée par la montée de patch (15.5.27).
- **Critique Handlebars** : dépendance de développement (chaîne de tests/outillage), absente de l'audit de production ; corrigée par 4.7.9.
- **Hautes NestJS** (`@nestjs/core`, `platform-express`, `swagger`), `multer`, `path-to-regexp`, `ws`, `socket.io-parser`, `engine.io`, `lodash`, `js-yaml`, `sharp`, `nanoid`, etc. : corrigées par mises à jour dans les plages existantes.

## Alertes hautes restantes en production (9) — non corrigées, analyse

Aucune n'est corrigée sans migration majeure ; le registre interdit de les appliquer à l'aveugle (Sentry, Tailwind, Turbo, Jest, rétrogradation ESLint).

| Paquet | Origine | Applicabilité | Mesure / échéance |
|---|---|---|---|
| `@sentry/nextjs` 8.55, `@sentry/webpack-plugin`, `@sentry/bundler-plugin-core`, `unplugin`, `rollup`, `braces`, `chokidar` | chaîne d'outillage de build de `@sentry/nextjs` ≤ 10.39 | exécutés à la compilation (source maps, globbing), pas dans le serveur en production ; les failles visent des entrées contrôlées par un attaquant (motifs de glob, fichiers) que le build n'accepte pas | corriger par migration `@sentry/nextjs` 11.x (changement majeur : valider l'instrumentation et la configuration Sentry) ; à planifier avant ouverture publique |
| `postcss` 8.4.31 imbriqué dans `next` | dépendance interne de Next 15 | XSS à la sérialisation de CSS non échappé et lecture de fichiers via `sourceMappingURL` : le projet ne traite pas de CSS fourni par des utilisateurs | corrigée par Next 16.x (majeur) ; suivre les correctifs 15.x |
| `picomatch` 4.0.2 (racine) | glob de l'outillage | ReDoS/injection sur motifs de glob fournis par le développeur | résolution de l'arbre à revoir (forcer une version ≥ 4.0.4 via `overrides` après test) |

Les 25 alertes modérées de production et les 42 hautes du périmètre complet (outillage de développement : Jest, ESLint, Tailwind, Turbo, ts-jest…) restent à trier ; leur décompte ne mesure pas l'exploitabilité.

## Validation après correction (local, sans CI)

- `npm ci` puis installation propre, `prisma generate`.
- Build séquentiel réussi : `@xnova/game-config`, `@xnova/game-engine`, `@xnova/api` (`nest build`) et `@xnova/web` (`next build`, pages générées).
- Tests : 35/35 unitaires, 62/62 d'intégration sur PostgreSQL 16 vierge.
- Non exécutés : E2E, lint (ESLint non configuré côté web : `next lint` demande une configuration interactive), parcours navigateur.
- `npm run build` à froid (Turbo) échoue toujours : `@xnova/game-engine` compile avant `@xnova/game-config` faute de dépendance déclarée (QUAL-01, défaut préexistant, non lié à cette mise à jour).

## Reste à faire

- Migration `@sentry/nextjs` 11.x puis nouvel audit de production.
- Corriger `picomatch` (override) et trier les modérées.
- Brancher `npm audit --omit=dev` en CI avec seuil sur critiques/hautes de production (QUAL-01).


## Seconde passe — SEC-01 (4 octobre 2026, après SCOPE-01)

Rapports bruts : `docs/audits/npm-audit-2026-10-04b-before-prod.json`, `…-after-prod.json`, `…-after-full.json` (Node 22.22.0).

| Périmètre | Avant (reprise) | Après |
|---|---|---|
| Production (`--omit=dev`) | 34 — 0 critique, **9 hautes**, 25 modérées | 3 — 0 critique, **0 haute**, 3 modérées |
| Complet (dev + prod) | 72 — 42 hautes | 42 — 34 hautes (outillage de développement), 8 modérées |

Actions :

- **Migration `@sentry/nextjs` 8 → 11.4 (web) et `@sentry/node` / `@sentry/profiling-node` 8 → 11.4 (API).** Supprime sept des neuf hautes (`@sentry/webpack-plugin`, `@sentry/bundler-plugin-core`, `unplugin`, `rollup`, `braces`, `chokidar`, `@sentry/nextjs`). Adaptations : `withSentryConfig` s'importe désormais depuis `@sentry/nextjs/config` ; `profilesSampleRate` n'existe plus (remplacé par `profileSessionSampleRate` avec `profileLifecycle: 'trace'`, même taux). Prérequis : Node ≥ 20.19 (≥ 22.12 pour Node 22) — `engines` relevé à `>=20.19.0`.
- **`picomatch` (haute)** : `overrides` ciblé `@angular-devkit/core → picomatch ^4.0.4` (le paquet de l'outillage Nest épinglait 4.0.2) ; les autres consommateurs sont passés en 4.0.7.
- **`postcss` imbriqué dans Next 15 (haute)** : `overrides` `next → postcss ^8.5.23` au lieu d'attendre Next 16 ; le build, les tests et les parcours E2E passent avec cette version.
- Seuil CI de l'audit de production relevé de « critiques » à **« hautes et critiques »**.

Reste, en production (3 modérées) : `ajv` (ReDoS avec l'option `$data`), `js-yaml` (fusion de clés YAML) et `@nestjs/swagger` (qui les embarque) : non exposés à un joueur (aucune donnée utilisateur n'est analysée par ces fonctions) ; `npm audit fix` ne propose pas de correctif sans montée majeure ; à revoir à la prochaine mise à jour de NestJS.

Reste, hors production (34 hautes) : chaîne de test et de compilation — Jest 29 (`jest-*`, `@jest/*`, `babel-jest`), `tailwindcss` 3, `eslint-config-next`, `fast-glob`, `micromatch`, `braces`, `chokidar` — corrigeable seulement par des migrations majeures (Jest 30, Tailwind 4, eslint-config-next 16) que le registre interdit d'appliquer à l'aveugle. Ces paquets ne tournent ni dans l'API ni dans le serveur web en production ; les failles (déni de service par motifs de glob pathologiques) exigent un motif fourni par le développeur. Échéance proposée : planifier ces migrations avec SCOPE-02/OPS-03, avant l'ouverture publique.

Limites : le suivi d'erreurs Sentry n'a pas été vérifié contre un vrai projet Sentry (DSN absent en test) : seuls le build, le chargement des modules et les parcours E2E sont validés ; le serveur Next n'initialise toujours pas Sentry côté serveur (pas de `instrumentation.ts`, comme avant la migration) ; le profilage Node (`profiling-node`) nécessite sa compilation native (`npm ci` sans `--ignore-scripts` en production).

Validation locale : `npm ci --dry-run`, builds complets (Turbo, 5/5), lint, unitaires 38/38, intégration 211/211, E2E 24/24.


## Troisième passe — alertes publiées après coup (6 octobre 2026)

Le seuil CI « hautes et critiques » a fait son travail : deux nouvelles alertes de production sont apparues entre deux exécutions, sans changement de code.

- `proxy-addr` 2.0.7 (**critique**, usurpation d'adresse IP via un sous-réseau IPv4 mappé en IPv6) : l'API utilise `trust proxy` (variable `TRUST_PROXY`, `app.setup.ts`) et la limitation de débit repose sur `request.ip` : l'alerte était **applicable** derrière un proxy. Corrigée par la mise à jour de patch 2.0.8.
- `source-map-js` 1.2.1 (haute, déni de service sur des source maps) : outillage de compilation ; corrigée par 1.2.2.

Action : `npm update proxy-addr source-map-js` (lockfile seul, correctifs de patch). Production : 3 modérées, 0 haute, 0 critique. Validation locale : `npm ci --dry-run`, lint, builds, unitaires 42/42, intégration 211/211, E2E 24/24.

## Mise à jour du 10 octobre 2026 — critique corrigée, Jest 30, avertissements ESLint à zéro

Contexte : `scripts/update.sh` exécute `npm ci --include=dev` sur le serveur (la compilation en a besoin) ; l'audit complet affichait donc **49 alertes (14 modérées, 34 hautes, 1 critique)**. **Production (`npm audit --omit=dev`) : 0 haute, 0 critique** (3 modérées : `@nestjs/swagger → js-yaml`).

| Étape | Complet (dev + prod) | Détail |
|---|---|---|
| Départ | 49 : 1 critique, 34 hautes, 14 modérées | |
| `npm audit fix` (sans `--force`) | 48 : **0 critique**, 34 hautes | `handlebars` (critique, outillage de test) corrigé : 4 lignes du lockfile |
| Jest 29 → 30 (`jest`, `@types/jest`, `ts-jest` ≥ 29.4) — **DETTE-01 close** | 36 : 0 critique, **7 hautes**, 29 modérées | unitaires 81/81, intégration 280/280 sous Jest 30 |

**Les 7 hautes restantes viennent d'une seule alerte, `braces ≤ 3.0.3`** (déni de service par motifs imbriqués, GHSA-vfj7-8cjw-p6xm) : **aucune version corrigée n'existe sur npm** (3.0.3 est la dernière). Deux chaînes d'outillage de développement la transportent :

- `tailwindcss` 3 → `micromatch` / `chokidar` / `braces` : disparaît avec **Tailwind 4** (DETTE-02, migration visuelle à valider séparément).
- `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob 3.3.1` → `micromatch` → `braces` : **la version 16 conserve cette dépendance** (et exige ESLint ≥ 9) ; migrer ne supprime donc pas l'alerte. À suivre jusqu'à un correctif amont de `braces` ou de `fast-glob`.

Exploitabilité : ces paquets ne tournent qu'à la compilation et aux tests, sur des motifs de glob écrits par l'équipe ; ils ne sont pas dans le serveur en exécution. Les modérées ajoutées par Jest 30 (`ts-jest` → `js-yaml`, `@istanbuljs/*`) sont du même type. L'assistant `npm audit fix --force` proposerait des rétrogradations (ts-jest 27, eslint-config-next 14, Jest 25) : **à ne pas appliquer**.

Avertissements ESLint : **0** (étaient 105). Code mort retiré (animations jamais utilisées dans cinq pages, polices Google inutilisées, variables d'erreur inutilisées), `any` typés dans `src/` (JWT, gateway WebSocket, combat), `any` des mocks de tests autorisés par une règle dédiée, `PlanetSelector` mémoïsé, interfaces vides des composants UI remplacées par des alias de types.
