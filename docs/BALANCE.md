# ⚖️ Balance & paramètres dynamiques

Ce guide rassemble les multiplicateurs et formules que l’équipe utilise pendant le sprint 10 pour ajuster l’équilibrage (resources, coûts, vitesses, durées). Les valeurs sont exposées via le `ServerConfigService` et peuvent être modifiées via l’interface admin (`PUT /admin/config`).

## Multiplicateurs principaux (`ServerConfigValues`)

| Clé | Description | Valeur par défaut |
|-----|-------------|-------------------|
| `gameSpeed` | Multiplie les durées de construction, recherche et voyages (ex : 1 = temps réel, 2500 = accéléré). | env `GAME_SPEED` (2500 en dev) |
| `fleetSpeed` | Impacte le calcul des vitesses de flotte. | env `FLEET_SPEED` (2500) |
| `resourceMultiplier` | Multiplie la production par heure. | env `RESOURCE_MULTIPLIER` (1) |
| `buildingCostMultiplier` | Appliqué à tous les coûts batiments. | env `BUILDING_COST_MULTIPLIER` (1) |
| `researchCostMultiplier` | Appliqué aux coûts de recherche. | env `RESEARCH_COST_MULTIPLIER` (1) |
| `shipCostMultiplier` | Appliqué aux coûts de construction vaisseaux. | env `SHIP_COST_MULTIPLIER` (1) |
| `planetSize` | Champs max (init 163). | `GAME_CONSTANTS.INITIAL_FIELDS` |
| `maxBuildingLevel` / `maxTechnologyLevel` | Bornes globales pour les niveaux batiments et tech. | 100 |
| `baseMetal`, `baseCrystal`, `baseDeuterium` | Production/par seconde de base (utilisée par `game-engine`). | 20 / 10 / 0 |

> Les admin peuvent ajuster ces valeurs via l’endpoint `PUT /admin/config` (JWT + permissions). Toutes les modifications sont historisées dans `AdminAuditLog`.

## Formules clés

- **Coûts bâtiments** : `baseCost × factor^level × buildingCostMultiplier`. Chaque `building` de `packages/game-config/src/buildings.ts` référence `baseCost` et `factor`.
- **Durées builts** : `(metal + crystal) / (2500 × (1 + robotics) × 2^nanite)`, puis divisées par `gameSpeed`.
- **Production ressources** : calculée dans `packages/game-engine/src/resources.ts` avec `resourceMultiplier` + énergie (ventilation positive/negative).
- **Vitesse flottes** : prend le vaisseau le plus lent (facteur de base + boost par tech `combustion/impulsion/hyperespace`). Appliqué ensuite `fleetSpeed`.

## Prise de décision équilibrage

1. **Collecte métriques** : utiliser les endpoints `/statistics` et `/admin/overview` pour voir la distribution points/vitesse.
2. **Expérimentation** : modifier `resourceMultiplier` ou `buildingCostMultiplier` via Swagger `PUT /admin/config`.
3. **Validation** : relancer `npm run test:integration` (auth + planets) pour s’assurer que les calculs tiennent.

## Références

- `packages/game-config/src/buildings.ts` (coûts, prérequis).
- `packages/game-config/src/technologies.ts` et `ships.ts`.
- `ServerConfigService` (cache + admin).
- `docs/API_ENDPOINTS.md` pour retrouver l’endpoint `/admin/config`.

## Valeurs appliquées (Sprint 10)

| Clé | Valeur active (`.env` / admin) |
|-----|-------------------------------|
| `gameSpeed` | 2000 (accélération dosée) |
| `fleetSpeed` | 2200 (voyages rapides mais contrôlés) |
| `resourceMultiplier` | 1.25 (bonus production) |
| `buildingCostMultiplier` | 1.15 (coûts légèrement plus élevés) |
| `researchCostMultiplier` | 1.1 |
| `shipCostMultiplier` | 1.2 |

Ces valeurs peuvent être disparates dans `AdminController` (changer live) ou à travers `.env` / `ServerConfigService` (cache invalide). Pense à relancer `npm run test:integration` après chaque changement critique.
