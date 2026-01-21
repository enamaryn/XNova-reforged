# AGENT.md

Ce fichier fournit des directives spécifiques pour les agents Claude travaillant sur ce dépôt.

## ⚠️ RÈGLES OBLIGATOIRES

### 1. Règle Linguistique Absolue

**OBLIGATOIRE : Toutes les communications doivent être exclusivement en français.**
- Toutes les explications, commentaires et messages doivent être écrits en français
- Les commentaires de code ajoutés doivent être en français
- Les termes techniques et identifiants de code restent dans leur forme originale (anglais)
- Les messages d'erreur et textes utilisateur doivent être en français

### 2. Mise à Jour de la Documentation

**OBLIGATOIRE : Toujours mettre à jour les fichiers de suivi après avoir complété des tâches.**

À la fin de chaque session de travail ou après avoir terminé une tâche significative, vous DEVEZ mettre à jour :

1. **CLAUDE_SESSION.md** - Historique des sessions et progression
   - Ajouter une nouvelle entrée de session avec date et objectif
   - Lister toutes les tâches accomplies avec des checkboxes
   - Documenter les fichiers créés et leur fonction
   - Mettre à jour l'état actuel du projet
   - Définir les prochaines étapes

2. **ROADMAP_MVP.md** ou **ROADMAP_COMPLET.md** - Feuille de route
   - Cocher les tâches complétées dans le sprint concerné
   - Mettre à jour le statut du sprint (non commencé / en cours / terminé)
   - Ajouter des notes sur les écarts par rapport au plan

3. **TodoWrite** - Pendant le travail actif
   - Utiliser l'outil TodoWrite pour suivre les tâches en cours
   - Marquer les tâches comme terminées au fur et à mesure
   - Garder exactement UNE seule tâche en status in_progress

Ces mises à jour ne sont PAS optionnelles - elles sont critiques pour maintenir le contexte entre les sessions et éviter la duplication de travail.

## Contexte du Projet

XNova Reforged est une réécriture complète d'un MMORPG de stratégie spatiale utilisant :
- **Backend** : NestJS + Prisma + PostgreSQL + Redis
- **Frontend** : Next.js 15 + TailwindCSS + shadcn/ui
- **Monorepo** : Turborepo avec workspaces npm

## Principes de Développement

### 1. Architecture et Séparation des Responsabilités

**Respecter strictement la séparation en couches :**

- `packages/game-config/` : Configuration statique uniquement (constantes, définitions)
- `packages/game-engine/` : Logique métier pure, sans dépendances framework
- `packages/database/` : Schéma Prisma et client, rien d'autre
- `apps/api/` : Couche HTTP/WebSocket, orchestration, validation
- `apps/web/` : Interface utilisateur, gestion d'état UI

**Ne jamais :**
- Mettre de la logique métier dans les contrôleurs NestJS
- Accéder directement à la base de données depuis le frontend
- Mélanger logique UI et logique métier

### 2. Formules de Jeu

**CRITIQUE : Toute implémentation de mécanique de jeu DOIT respecter les formules du fichier [GAME_FORMULAS.md](GAME_FORMULAS.md)**

Ces formules proviennent du XNova 0.8 original (2008) et doivent être reproduites fidèlement :
- Production de ressources avec gestion de l'énergie
- Coûts exponentiels des bâtiments (baseCost × factor^level)
- Capacité de stockage (1,000,000 × 1.5^level)
- Mécaniques de combat (boucliers, armure, tirs rapides)
- Calculs de distance et vitesse des flottes

Avant d'implémenter une fonctionnalité de jeu, toujours consulter GAME_FORMULAS.md pour la formule exacte.

### 3. Base de Données

**Décisions de conception importantes :**

- Les niveaux de bâtiments sont stockés comme colonnes sur `Planet` (dénormalisé pour performance)
- Les vaisseaux et cargaisons de flottes utilisent JSON pour la flexibilité
- Les files d'attente (BuildQueue, ResearchQueue) sont des tables séparées
- Tous les timestamps doivent utiliser `DateTime` de Prisma

**Workflow de modification du schéma :**
1. Modifier `packages/database/prisma/schema.prisma`
2. Exécuter `npm run db:push` (dev) ou créer une migration (prod)
3. Régénérer le client : `cd packages/database && npx prisma generate`
4. Les types TypeScript sont automatiquement mis à jour

### 4. Configuration de Jeu

**Les IDs doivent être cohérents partout :**

Les ID définis dans `packages/game-config/src/` (buildings.ts, ships.ts, technologies.ts) doivent correspondre exactement aux ID utilisés dans :
- Les colonnes de la table Planet (ex: metalMine correspond au building ID 1)
- Les enregistrements Ship, Defense, Technology
- Les références dans BuildQueue et ResearchQueue

Ne jamais modifier un ID existant - cela casserait les données en production.

### 5. Gestion du Temps et Ressources

**Le jeu utilise un système de calcul basé sur le temps écoulé :**

```typescript
// Exemple de calcul de production
const timeSinceLastUpdate = now - planet.lastUpdate;
const metalProduced = (planet.metalProduction / 3600) * timeSinceLastUpdate;
```

**Points critiques :**
- Toujours mettre à jour `lastUpdate` après calcul de ressources
- Respecter les limites de stockage (avec overflow à 110%)
- Gérer l'énergie négative (production réduite proportionnellement)
- Les multiplier de vitesse sont définis dans `.env` (GAME_SPEED, FLEET_SPEED)

### 6. Sécurité

**Implémentation d'authentification :**
- Utiliser Argon2 pour le hashing (JAMAIS bcrypt ou pire)
- JWT avec rotation de refresh tokens
- Sessions stockées dans Redis
- Validation stricte des inputs (class-validator dans NestJS)

**Prévention d'exploits :**
- Valider côté serveur que le joueur possède les ressources avant construction
- Vérifier les prérequis de bâtiments/technologies
- Empêcher actions multiples simultanées (une recherche à la fois, etc.)
- Valider que les coordonnées galactiques sont dans les limites

### 7. Performance

**Optimisations importantes :**

- Utiliser Redis pour cacher les données de planètes fréquemment accédées
- Batching des updates de ressources (ne pas calculer à chaque requête)
- Indexation Prisma sur tous les champs de requête fréquents
- WebSocket pour les updates temps réel au lieu de polling

**Anti-patterns à éviter :**
- N+1 queries (utiliser Prisma `include` correctement)
- Charger toutes les planètes d'un univers en une requête
- Calculs complexes dans les boucles de rendu React

### 8. Patterns de Code

**NestJS (Backend) :**
```typescript
// Structure d'un module
@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ResourceController],
  providers: [ResourceService, ResourceCalculator],
  exports: [ResourceService],
})
```

**Next.js (Frontend) :**
- Utiliser Server Components par défaut
- Client Components uniquement quand nécessaire (interactivité, hooks)
- Groupes de routes avec (parentheses) pour layouts partagés
- API calls via React Query pour caching automatique

**Zustand (State Management) :**
```typescript
// Store pour données utilisateur
interface UserStore {
  user: User | null;
  planets: Planet[];
  setUser: (user: User) => void;
}
```

## Tâches Courantes

### Ajouter un Nouveau Bâtiment

1. Ajouter la définition dans `packages/game-config/src/buildings.ts`
2. Ajouter la colonne dans le modèle `Planet` dans `schema.prisma`
3. Implémenter la logique de production dans `packages/game-engine/`
4. Créer l'endpoint de construction dans `apps/api/src/game/buildings/`
5. Ajouter l'UI dans `apps/web/app/(game)/buildings/`

### Ajouter une Nouvelle Technologie

1. Définir dans `packages/game-config/src/technologies.ts`
2. Vérifier que le modèle `Technology` supporte le nouvel ID
3. Implémenter les prérequis et effets dans `game-engine`
4. Endpoint API dans `apps/api/src/game/research/`
5. UI de recherche dans `apps/web/app/(game)/research/`

### Implémenter une Nouvelle Mécanique

1. Consulter GAME_FORMULAS.md pour la formule originale
2. Implémenter la logique pure dans `packages/game-engine/`
3. Écrire les tests unitaires (Jest)
4. Créer le service NestJS qui utilise le game-engine
5. Exposer via API REST et/ou WebSocket
6. Créer les composants UI React

## Tests

**Priorités de tests :**
- Tests unitaires pour toute logique de calcul (game-engine)
- Tests d'intégration pour les endpoints API critiques
- Tests E2E pour les flux utilisateur principaux (auth, construction, combat)

**Commandes :**
```bash
# Tests unitaires
npm run test

# Tests E2E
npm run test:e2e

# Coverage
npm run test:cov
```

## Débogage

**Outils disponibles :**
- Prisma Studio : `npm run db:studio` (visualiser DB)
- NestJS Logger : logs structurés dans console
- React DevTools : pour state Zustand et React Query
- Redis CLI : `docker exec -it xnova-redis redis-cli`

**Variables de debug dans `.env` :**
```
DEBUG_MODE=true           # Active logs verbeux
GAME_SPEED=2500          # Accélère le jeu pour tests
RESOURCE_MULTIPLIER=10   # Augmente production pour tests
```

## Conventions de Code

- **Langue** : Code et variables en anglais, commentaires en français
- **Naming** : camelCase pour variables/fonctions, PascalCase pour classes/types
- **Commits** : Messages en français, format conventionnel (feat:, fix:, docs:, etc.)
- **Imports** : Absolus via alias (`@xnova/database`, `@/components`)
- **Formatting** : Prettier configuré, exécuter `npm run format` avant commit

## Ressources Importantes

- [GAME_FORMULAS.md](GAME_FORMULAS.md) - Formules du jeu (référence absolue)
- [ROADMAP_MVP.md](ROADMAP_MVP.md) - Planification du MVP
- [GETTING_STARTED.md](GETTING_STARTED.md) - Guide d'installation détaillé
- [schema.prisma](packages/database/prisma/schema.prisma) - Schéma de base de données complet

## Rappels pour les Agents

1. **TOUJOURS communiquer en français** avec l'utilisateur
2. **TOUJOURS vérifier GAME_FORMULAS.md** avant d'implémenter une mécanique de jeu
3. **TOUJOURS respecter l'architecture en couches** (pas de logique métier dans les contrôleurs)
4. **TOUJOURS valider les actions côté serveur** (sécurité)
5. **TOUJOURS mettre à jour `lastUpdate`** lors de calculs de ressources
6. **TOUJOURS tester les formules** de calcul avec des valeurs connues
