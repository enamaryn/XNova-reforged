# Audit Performance — 12 octobre 2026 (PERF-MOBILE)

**Mesure** : `node scripts/perf/lighthouse.mjs http://127.0.0.1:3000 3` (Lighthouse 12.8.2, médiane de 3 passages, build de production, Chromium headless, émulation mobile standard). Résultats : [docs/audits/lighthouse-2026-10-12.json](audits/lighthouse-2026-10-12.json).

| Page | Mobile (avant → après) | Bureau |
|---|---|---|
| Accueil `/fr` | **67 → 96** (LCP 5,1 s → 2,7 s, TBT 556 ms → 0) | 100 |
| Connexion | 95 → 100 | 100 |
| Inscription | 97 → 99 | 100 |

**Cause** : le SDK Sentry navigateur était initialisé de façon statique (`instrumentation-client.ts`) et pesait ~120 Ko de JavaScript sur toutes les pages, même sans DSN (~0,5 s de calcul sur mobile). Il n'est plus chargé que si `NEXT_PUBLIC_SENTRY_DSN` est compilé, ou à l'exécution si l'administrateur active Sentry (`lib/monitoring/sentry-loader.ts`). Les images des cartes de l'accueil partagent désormais la même requête que l'image principale (même qualité), au lieu d'un second téléchargement.

Mesures hors accueil (pages de jeu, authentifiées) : non faites ; la variance d'un passage à l'autre est importante (71 à 91 sur le même build avant correction), d'où la médiane.

---

# Audit Performance - Initial

**Date :** 2026-01-21
**Page testee :** /fr/overview

## Scores Lighthouse
- Performance: N/A (audit non execute dans cet environnement)
- Accessibility: N/A
- Best Practices: N/A
- SEO: N/A

## Problemes identifies
1. Audit Lighthouse impossible ici (pas de navigateur/CLI disponible).
2. Build initial bloque hors reseau (telechargement des polices Google).

## Metriques Core Web Vitals
- LCP (Largest Contentful Paint): N/A
- FID (First Input Delay): N/A
- CLS (Cumulative Layout Shift): N/A

## Bundle
- First Load JS shared by all: 166 kB (build local apres correctifs)

---

# Audit Performance - Final

**Date :** 2026-01-21
**Page testee :** /fr/overview

## Scores Lighthouse
- Performance: N/A (audit non execute dans cet environnement)
- Accessibility: N/A
- Best Practices: N/A
- SEO: N/A

## Ameliorations appliquees
1. Code splitting: 1 composant lazy-load (CombatNotifications).
2. Memoization: 5 composants memoises (BuildingCard, ResourceDisplay, EnergyDisplay, PlanetScene, CombatReportCard).
3. Calculs memoises: 4 regroupements/listes (GameSidebar, buildings, research, galaxy).
4. Prefetch ajuste: liens admin non-prefetch.
5. Build config: optimizeCss + removeConsole + formats d'image AVIF/WebP.

## Metriques finales
- First Load JS: 166 kB (objectif < 500 kB) OK
- LCP: N/A
- FID: N/A
- CLS: N/A

## Notes
- Lighthouse et audit CWV a relancer en local avec un navigateur.
- Warnings Sentry pendant le build (instrumentation hook manquant) sans impact bloquant.
