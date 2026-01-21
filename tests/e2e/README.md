# Tests E2E - XNova Reforged

Tests end-to-end avec Playwright sur Chromium.

## Prérequis

```bash
# Installer les dependances systeme + Chromium (auto-detect OS)
./scripts/install-playwright-deps.sh

# Ou uniquement Chromium (si deps déjà présentes)
npx playwright install chromium

# S'assurer que Docker est lancé (PostgreSQL + Redis)
npm run docker:up

# Pousser le schéma Prisma
npm run db:push
```

## Lancer les tests

```bash
# Lancer tous les tests e2e (Chromium)
npm run test:e2e

# Lancer un test spécifique
npx playwright test tests/e2e/auth.spec.ts --project=chromium

# Lancer avec interface graphique
npx playwright test --ui

# Lancer en mode debug
npx playwright test --debug

# Voir le rapport après les tests
npx playwright show-report
```

## Liste des tests

| Fichier | Tests | Description |
|---------|-------|-------------|
| `auth.spec.ts` | 1 | Inscription et accès vue d'ensemble |
| `buildings.spec.ts` | 1 | Construction de bâtiment |
| `research.spec.ts` | 1 | Lancement d'une recherche |
| `shipyard.spec.ts` | 1 | Construction de vaisseau |
| `fleet.spec.ts` | 1 | Envoi de flotte |
| `combat.spec.ts` | 1 | Rapport de combat |
| `galaxy.spec.ts` | 1 | Navigation galaxie |
| `messages.spec.ts` | 2 | Formulaire envoi + boîte de réception |
| `alliance.spec.ts` | 1 | Accès page alliance |
| `statistics.spec.ts` | 1 | Affichage statistiques |
| `admin.spec.ts` | 3 | Accès admin, config, accès refusé |

**Total : 14 tests**

## Structure

```
tests/e2e/
├── helpers.ts          # Fonctions utilitaires (registerUser, buildCredentials)
├── auth.spec.ts        # Authentification
├── buildings.spec.ts   # Bâtiments
├── research.spec.ts    # Technologies
├── shipyard.spec.ts    # Hangar spatial
├── fleet.spec.ts       # Flottes
├── combat.spec.ts      # Combat
├── galaxy.spec.ts      # Galaxie
├── messages.spec.ts    # Messagerie
├── alliance.spec.ts    # Alliances
├── statistics.spec.ts  # Statistiques
├── admin.spec.ts       # Administration
└── README.md           # Ce fichier
```

## Configuration

La configuration Playwright est dans `playwright.config.ts` à la racine :
- **Browser** : Chromium uniquement
- **Timeout** : 180s par test
- **Base URL** : http://localhost:3000
- **Traces** : Conservées en cas d'échec

## Helpers disponibles

### `buildCredentials(prefix: string)`
Génère un username et email uniques pour les tests.

```typescript
const { username, email } = buildCredentials('e2e_test');
// username: "e2e_test_abc123"
// email: "e2e_test_abc123@xnova.local"
```

### `registerUser(page, credentials)`
Inscrit un utilisateur et attend la redirection vers `/overview`.

```typescript
const credentials = buildCredentials('e2e');
await registerUser(page, credentials);
// L'utilisateur est maintenant connecté sur /overview
```

## Dépannage

### Les tests échouent avec "timeout"
- Vérifier que l'API est lancée sur le port 3001
- Vérifier que le frontend est lancé sur le port 3000
- Augmenter les timeouts dans `playwright.config.ts`

### Erreur "element not found"
- Vérifier que la page est bien hydratée (React)
- Utiliser `waitForLoadState('networkidle')` si nécessaire

### Voir les traces d'erreur
```bash
npx playwright show-trace test-results/*/trace.zip
```

## CI/CD

Pour GitHub Actions :

```yaml
- name: Install Playwright
  run: npx playwright install chromium --with-deps

- name: Run E2E tests
  run: npm run test:e2e
```
