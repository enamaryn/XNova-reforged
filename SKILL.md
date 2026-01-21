# SKILL.md - Guide de Tests XNova Reforged

Ce document décrit la stratégie de test complète du projet XNova Reforged.
Il sert de référence pour tout développeur (humain ou IA) travaillant sur les tests.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Types de tests](#types-de-tests)
3. [Tests unitaires API](#tests-unitaires-api)
4. [Tests d'intégration API](#tests-dintégration-api)
5. [Tests E2E Playwright](#tests-e2e-playwright)
6. [Règles et conventions](#règles-et-conventions)
7. [Pièges à éviter](#pièges-à-éviter)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

```
XNova-reforged/
├── apps/api/test/                    # Tests API (Jest)
│   ├── jest.setup.ts                 # Configuration globale Jest
│   ├── *.spec.ts                     # Tests unitaires
│   └── integration/                  # Tests d'intégration
│       └── auth.integration.spec.ts
├── tests/e2e/                        # Tests E2E (Playwright)
│   ├── helpers.ts                    # Fonctions utilitaires
│   └── *.spec.ts                     # Tests end-to-end
├── apps/api/jest.config.cjs          # Config Jest unitaire
├── apps/api/jest.integration.config.cjs  # Config Jest intégration
└── playwright.config.ts              # Config Playwright
```

### Commandes principales

```bash
# Tests unitaires API
npm run test                    # Tous les tests unitaires

# Tests d'intégration API
npm run test:integration        # Tests avec vraie DB

# Tests E2E
npm run test:e2e               # Tous les tests Playwright
npm run test:e2e:ui            # Interface graphique Playwright
```

---

## Types de tests

### 1. Tests unitaires (`apps/api/test/*.spec.ts`)

**Objectif** : Tester la logique métier de manière isolée avec des mocks.

| Fichier | Description |
|---------|-------------|
| `resources.service.spec.ts` | Calcul des ressources, renommage, colonisation |
| `combat.service.spec.ts` | Résolution des combats, rapports |
| `guards.spec.ts` | Guards d'autorisation (RolesGuard, AdminGuard) |
| `resources.dto.spec.ts` | Validation des DTOs |

**Caractéristiques** :
- Utilisent des mocks pour la DB et les dépendances
- Rapides à exécuter (< 5 secondes)
- Ne nécessitent pas Docker

### 2. Tests d'intégration (`apps/api/test/integration/*.spec.ts`)

**Objectif** : Tester le flux complet avec une vraie base de données.

| Fichier | Description |
|---------|-------------|
| `auth.integration.spec.ts` | Inscription, connexion, récupération planète |
| `planets.integration.spec.ts` | Liste des bâtiments, file d'attente de construction, lancement + annulation |

**Caractéristiques** :
- Utilisent la vraie DB PostgreSQL via Docker
- Testent les endpoints HTTP avec Supertest
- Nettoient les données après chaque test

### 3. Tests E2E (`tests/e2e/*.spec.ts`)

**Objectif** : Tester l'application complète du point de vue utilisateur.

| Fichier | Tests | Description |
|---------|-------|-------------|
| `auth.spec.ts` | 2 | Inscription et connexion |
| `buildings.spec.ts` | 1 | Construction de bâtiment |
| `research.spec.ts` | 1 | Lancement d'une recherche |
| `shipyard.spec.ts` | 1 | Construction de vaisseau |
| `fleet.spec.ts` | 1 | Envoi de flotte |
| `combat.spec.ts` | 1 | Rapport de combat |
| `galaxy.spec.ts` | 1 | Navigation galaxie |
| `messages.spec.ts` | 2 | Messagerie |
| `alliance.spec.ts` | 1 | Alliances |
| `statistics.spec.ts` | 1 | Statistiques |
| `admin.spec.ts` | 3 | Administration |

---

## Tests unitaires API

### Configuration (`jest.config.cjs`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/integration/'],  // Exclut l'intégration
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  moduleNameMapper: {
    '^@xnova/(.*)$': '<rootDir>/../../packages/$1/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
```

### Pattern de mock pour les services

```typescript
// Créer un service avec des mocks
const createService = () => {
  const database = {
    planet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // ... autres modèles
  };

  const otherDependency = {
    someMethod: jest.fn(),
  };

  return {
    service: new MyService(database as any, otherDependency as any),
    database,
    otherDependency,
  };
};

describe('MyService', () => {
  afterEach(() => {
    jest.clearAllMocks();  // IMPORTANT: nettoyer après chaque test
  });

  it('fait quelque chose', async () => {
    const { service, database } = createService();
    database.planet.findUnique.mockResolvedValue({ id: 'test' });

    const result = await service.doSomething();

    expect(database.planet.findUnique).toHaveBeenCalledWith(/* ... */);
    expect(result).toEqual(/* ... */);
  });
});
```

### Mock des modules externes

```typescript
// Mock de game-engine
jest.mock('@xnova/game-engine', () => ({
  updateResources: jest.fn(),
  simulateCombat: jest.fn(),
}));

const updateResourcesMock = updateResources as jest.MockedFunction<typeof updateResources>;

// Dans les tests
updateResourcesMock.mockReturnValue({ /* ... */ });
```

---

## Tests d'intégration API

### Configuration (`jest.integration.config.cjs`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],  // SEULEMENT l'intégration
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  testTimeout: 30000,  // Timeout plus long pour la DB
  // ... même moduleNameMapper
};
```

### Structure d'un test d'intégration

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

describe('API integration - Feature', () => {
  let app: INestApplication;
  let database: DatabaseService;

  // IMPORTANT: Identifiants uniques et COURTS
  const unique = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);
  const testUser = {
    username: `it_${unique}`,  // MAX 20 caractères !
    email: `itest_${unique}@example.test`,
    password: 'Test1234!',
  };

  beforeAll(async () => {
    // Configurer les variables d'environnement
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    // Créer le module de test avec l'AppModule complet
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    // IMPORTANT: Nettoyer les données de test
    if (database) {
      const existing = await database.user.findUnique({
        where: { username: testUser.username },
        select: { id: true },
      });
      if (existing) {
        await database.user.delete({ where: { id: existing.id } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('fait le test complet', async () => {
    // Test avec supertest
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body?.tokens?.accessToken).toBeTruthy();
  });
});
```

> La documentation vivante de cette procédure est disponible dans `docs/INTEGRATION_TESTS.md`, avec les commandes Docker/Prisma et l'astuce : la sandbox Codex bloque les sockets réseau (`Operation not permitted`), donc les tests d'intégration ne peuvent pas atteindre Postgres/Redis ici, il faut les lancer sur un poste/CI avec accès complet aux containers.

---

## Tests E2E Playwright

### Prérequis

```bash
# Installer Playwright et Chromium
npx playwright install chromium

# S'assurer que Docker est lancé
npm run docker:up

# Initialiser la DB
npm run db:push
```

### Helpers disponibles (`tests/e2e/helpers.ts`)

#### `buildCredentials(prefix: string)`

Génère des identifiants uniques et valides (< 20 caractères).

```typescript
const { username, email } = buildCredentials('e2e');
// username: "e2e_abc123" (max 20 chars)
// email: "e2e_abc123@xnova.local"
```

#### `registerUser(page, credentials)`

Inscrit un utilisateur et attend la redirection.

```typescript
const credentials = buildCredentials('e2e');
await registerUser(page, credentials);
// Maintenant sur /overview
```

#### `loginUser(page, credentials)`

Connecte un utilisateur existant.

```typescript
await loginUser(page, { identifier: 'username', password: 'Test1234' });
```

### Structure d'un test E2E

```typescript
import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';

test('description du test', async ({ page }) => {
  // 1. Créer des credentials uniques
  const credentials = buildCredentials('e2e_feature');

  // 2. Inscrire l'utilisateur
  await registerUser(page, credentials);

  // 3. Naviguer et tester
  await page.goto('/some-page');
  await expect(page.getByRole('heading', { name: 'Titre' })).toBeVisible();

  // 4. Interagir
  await page.getByRole('button', { name: 'Action' }).click();

  // 5. Vérifier le résultat
  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## Règles et conventions

### 1. Nommage des fichiers

```
*.spec.ts           # Tests unitaires
*.integration.spec.ts  # Tests d'intégration (dans integration/)
*.spec.ts           # Tests E2E (dans tests/e2e/)
```

### 2. Nommage des tests (en français)

```typescript
it('met a jour les ressources et retourne le recapitulatif', ...);
it('refuse le renommage si la planete est absente', ...);
it('inscription et acces a la vue d ensemble', ...);
```

### 3. Identifiants de test

**CRITIQUE** : Les noms d'utilisateur sont limités à **20 caractères**.

```typescript
// ❌ MAUVAIS - Trop long (27 chars)
const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const username = `itest_${unique}`;  // "itest_1737189628123-1234"

// ✅ BON - Court et unique
const unique = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);
const username = `it_${unique}`;  // "it_abc12345" (11 chars)
```

### 4. Nettoyage des données

Toujours nettoyer les données de test dans `afterAll` ou `afterEach`.

```typescript
afterAll(async () => {
  // Supprimer l'utilisateur de test
  await database.user.delete({ where: { username: testUser.username } });
});
```

### 5. Variables d'environnement

Les tests d'intégration doivent définir les variables JWT :

```typescript
beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
});
```

---

## Pièges à éviter

### 1. Reflector manquant dans les modules

Si un module utilise `@UseGuards(RolesGuard)`, il DOIT avoir `Reflector` comme provider.

```typescript
// ❌ MAUVAIS - RolesGuard ne peut pas injecter Reflector
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

// ✅ BON - Reflector est disponible
@Module({
  controllers: [AdminController],
  providers: [AdminService, Reflector],
})
export class AdminModule {}
```

### 2. Nom d'utilisateur trop long

La validation DTO limite les usernames à 20 caractères.

```typescript
// ❌ MAUVAIS
username: `itest_${Date.now()}_${Math.random()}`;  // ~30 chars

// ✅ BON
username: `it_${Date.now().toString(36).slice(-6)}`;  // ~10 chars
```

### 3. Oublier jest.clearAllMocks()

Les mocks persistent entre les tests sans nettoyage.

```typescript
afterEach(() => {
  jest.clearAllMocks();  // Obligatoire !
});
```

### 4. Conflits de versions NestJS

Le projet utilise NestJS 10. Vérifier l'alignement :

```bash
npm ls @nestjs/core
```

Toutes les dépendances `@nestjs/*` doivent être en v10.x.

### 5. Cache Jest obsolète

Si les tests échouent de manière inexplicable :

```bash
npx jest --clearCache
```

### 6. Test d'intégration sans Docker

Les tests d'intégration nécessitent PostgreSQL et Redis :

```bash
npm run docker:up  # Avant de lancer les tests
```

---

## Dépannage

### Erreur "Nest can't resolve dependencies of RolesGuard"

**Cause** : `Reflector` n'est pas fourni dans le module.

**Solution** :
```typescript
import { Reflector } from '@nestjs/core';

@Module({
  providers: [MyService, Reflector],
})
export class MyModule {}
```

### Erreur "Le nom d'utilisateur ne peut pas dépasser 20 caractères"

**Cause** : L'identifiant généré est trop long.

**Solution** : Utiliser un format court :
```typescript
const unique = Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);
const username = `it_${unique}`;
```

### Erreur "timeout" dans les tests E2E

**Causes possibles** :
1. L'API n'est pas lancée (port 3001)
2. Le frontend n'est pas lancé (port 3000)
3. La DB n'est pas accessible

**Solutions** :
```bash
npm run docker:up
npm run dev  # Dans un autre terminal
npm run test:e2e
```

### Erreur de compilation TypeScript dans les tests

**Cause** : Types incompatibles entre packages.

**Solution** :
```bash
cd packages/database && npm run db:generate
npm install  # Réinstaller les dépendances
```

### Les tests passent localement mais pas en CI

**Causes possibles** :
1. Variables d'environnement manquantes
2. Playwright pas installé
3. Chromium manquant

**Solution CI** :
```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install chromium --with-deps

- name: Start services
  run: npm run docker:up

- name: Run tests
  run: npm run test:integration
```

---

## Checklist avant commit

- [ ] `npm run test` passe (tests unitaires)
- [ ] `npm run test:integration` passe (avec Docker)
- [ ] `npm run test:e2e` passe (avec app lancée)
- [ ] Pas de `console.log` de debug dans les tests
- [ ] Les données de test sont nettoyées
- [ ] Les noms d'utilisateur font < 20 caractères
- [ ] `jest.clearAllMocks()` dans `afterEach`

---

## Références

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Supertest](https://github.com/ladjs/supertest)
