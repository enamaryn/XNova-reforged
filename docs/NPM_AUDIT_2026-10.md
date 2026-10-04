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
