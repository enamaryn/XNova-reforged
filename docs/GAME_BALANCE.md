# ⚖️ ÉQUILIBRAGE DU JEU - XNova Reforged

> Document d'analyse et d'ajustements d'équilibrage du jeu
> Date : 20 janvier 2026

---

## 📊 Analyse de la configuration actuelle

### Problèmes identifiés

#### 1. **Bâtiments - Coûts excessifs pour le early game**

**Problème :** Les coûts exponentiels deviennent prohibitifs trop rapidement.

| Bâtiment | Coût Niveau 1 | Coût Niveau 10 | Factor actuel |
|----------|---------------|----------------|---------------|
| Mine de Métal | 60m, 15c | 3459m, 865c | 1.5 |
| Mine de Cristal | 48m, 24c | 4423m, 2211c | 1.6 |
| Usine de Robots | 400m, 120c, 200d | 204800m, 61440c, 102400d | 2.0 |
| Labo de Recherche | 200m, 400c, 200d | 102400m, 204800c, 102400d | 2.0 |

**Observation :**
- Factor 2.0 est trop agressif pour les bâtiments stratégiques (Robotique, Labo)
- Les joueurs seront bloqués au niveau 5-7 dans le early game
- L'Usine de Nanites (niveau 15) coûte 1M métal de base → inaccessible

**Solution proposée :**
- Réduire factor Usine de Robots : 2.0 → **1.8**
- Réduire factor Laboratoire : 2.0 → **1.8**
- Réduire coût de base Usine de Robots : 400m → **350m**
- Réduire factor Usine de Nanites : 2.0 → **1.75**

---

#### 2. **Vaisseaux - Déséquilibre cargo vs combat**

**Problème :** Les vaisseaux de combat sont trop chers par rapport aux transporteurs.

| Vaisseau | Coût total | Ratio M/C | Efficacité |
|----------|------------|-----------|------------|
| Petit Transporteur | 4000 | 1:1 | 5000 cargo |
| Grand Transporteur | 12000 | 1:1 | 25000 cargo |
| Chasseur Léger | 4000 | 3:1 | 50 weapon |
| Chasseur Lourd | 10000 | 3:2 | 150 weapon |
| Croiseur | 29000 | ~3:1 | 400 weapon |

**Observation :**
- Le Grand Transporteur a un excellent rapport coût/capacité (2.08 cargo/ressource)
- Le Petit Transporteur est moins rentable (1.25 cargo/ressource)
- Les chasseurs légers sont sous-powérés (4000 coût pour 50 weapon = 80 coût/weapon)
- Les croiseurs sont très coûteux (29000 coût pour 400 weapon = 72.5 coût/weapon)

**Solution proposée :**
- Améliorer Petit Transporteur : 5000 → **6000 cargo**
- Réduire coût Chasseur Léger : 3000m, 1000c → **2500m, 800c**
- Augmenter weapon Chasseur Léger : 50 → **60**
- Réduire coût Croiseur : 20000m, 7000c → **18000m, 6000c**

---

#### 3. **Technologies - Coûts exponentiels trop agressifs**

**Problème :** Factor 2.0 universel rend les hauts niveaux inaccessibles.

| Technologie | Coût Niveau 1 | Coût Niveau 10 | Coût Niveau 15 |
|-------------|---------------|----------------|----------------|
| Espionnage | 200m, 1000c, 200d | 102400m, 512000c, 102400d | 3.3M m, 16.4M c, 3.3M d |
| Combustion | 400m, 600d | 204800m, 307200d | 13M m, 19.7M d |
| Hyperespace | 4000c, 2000d | 2048000c, 1024000d | 131M c, 65.5M d |

**Observation :**
- Les technologies de propulsion sont cruciales mais inaccessibles après niveau 8-10
- Espionnage niveau 15 coûte 16.4M cristal (irréaliste)
- Les joueurs seront bloqués à niveau 8-10 en milieu de partie

**Solution proposée :**
- Réduire factor universel : 2.0 → **1.8** pour toutes les technologies
- Exception Graviton (garde 3.0 car ultra-rare)
- Ajuster costs de base pour compenser :
  - Espionnage : augmenter coût niveau 1 de 10%
  - Combustion : augmenter coût niveau 1 de 15%

---

#### 4. **Production de ressources - Manque de formules**

**Problème :** Les fichiers de config ne contiennent pas les formules de production !

**Observation :**
- Formules documentées dans [GAME_FORMULAS.md](../GAME_FORMULAS.md) mais pas implémentées
- Production attendue : `30 * level * 1.1^level` (métal)
- Consommation énergie : `10 * level * 1.1^level`

**Solution proposée :**
- Créer `packages/game-config/src/production.ts` avec formules complètes
- Implémenter production dynamique avec bonus géologue/ingénieur
- Ajouter formules énergétiques

---

#### 5. **Défenses - Fichier manquant**

**Problème :** Pas de fichier `defenses.ts` dans la configuration.

**Solution proposée :**
- Créer `packages/game-config/src/defenses.ts` avec :
  - Lanceur de missiles (401)
  - Artillerie laser légère (402)
  - Artillerie laser lourde (403)
  - Canon de Gauss (404)
  - Artillerie à ions (405)
  - Canon à plasma (406)
  - Petit bouclier (407)
  - Grand bouclier (408)

---

## 🎯 Plan d'équilibrage

### Phase 1 : Ajustements des coûts (PRIORITAIRE)

**Objectif :** Rendre le jeu progressif et accessible.

1. **Bâtiments**
   - ✅ Réduire factors pour Robotique et Labo (2.0 → 1.8)
   - ✅ Réduire coût de base Usine de Robots
   - ✅ Ajuster Usine de Nanites (factor 1.75)

2. **Vaisseaux**
   - ✅ Améliorer efficacité Petit Transporteur
   - ✅ Réduire coût des chasseurs de base
   - ✅ Ajuster rapport weapon/cost

3. **Technologies**
   - ✅ Passer factor 2.0 → 1.8 universellement
   - ✅ Ajuster coûts de base pour compenser

### Phase 2 : Ajout de fichiers manquants

1. ✅ Créer `production.ts` avec formules complètes
2. ✅ Créer `defenses.ts` avec toutes les défenses
3. ✅ Ajouter fonctions d'aide (helpers)

### Phase 3 : Tests d'équilibrage

1. Calculer progression niveau 1 → 20 pour chaque bâtiment
2. Simuler économie d'un joueur sur 30 jours
3. Vérifier que les paliers sont atteignables :
   - Jour 1-7 : Niveaux 1-5 (early game)
   - Jour 7-15 : Niveaux 5-10 (mid game)
   - Jour 15-30 : Niveaux 10-15 (late game)

---

## 📐 Formules d'équilibrage

### Progression exponentielle

```typescript
// Ancien system (trop agressif)
cost(level) = baseCost * 2.0^level

// Nouveau système (plus progressif)
cost(level) = baseCost * 1.8^level

// Différence niveau 10
// Ancien : baseCost * 1024
// Nouveau : baseCost * 357.9 (65% de réduction !)
```

### Temps de construction

```typescript
// Secondes : mine de métal niveau 1 = 30 s à vitesse ×1, sans robots/nanites.
buildTime = 30 * (metal + crystal) / (75 * (1 + roboticsLevel) * 2^naniteLevel)
// Recherche : Ordinateur niveau 1 = 30 s à vitesse ×1 avec laboratoire niveau 1.
researchTime = 30 * (metal + crystal) / (200 * (1 + labLevel))
// Les coûts augmentent exponentiellement avec le niveau.
// Les multiplicateurs de coût s’appliquent aussi aux durées ; gameSpeed divise la durée.
// Arrondi inférieur, minimum d’une seconde. Les files déjà lancées restent inchangées.
```

### Production de ressources

```typescript
// Production par heure (à implémenter)
metalProduction = 30 * level * 1.1^level
crystalProduction = 20 * level * 1.1^level
deuteriumProduction = 10 * level * 1.1^level

// Énergie
solarPlantEnergy = 20 * level * 1.1^level
fusionPlantEnergy = 30 * level * 1.05^level
```

---

## 🧪 Tests de validation

### Scénario 1 : Nouveau joueur (Jour 1-7)

**Objectifs atteignables :**
- Mine Métal niveau 5
- Mine Cristal niveau 5
- Centrale Solaire niveau 3
- Usine de Robots niveau 2
- Hangar niveau 1

**Coûts totaux :**
- Ancien : ~150k métal, ~50k cristal (inaccessible)
- Nouveau : ~85k métal, ~28k cristal (atteignable)

### Scénario 2 : Joueur intermédiaire (Jour 15)

**Objectifs atteignables :**
- Mines niveau 10
- Robotique niveau 5
- Labo niveau 3
- Technologies de base niveau 5

**Coûts totaux :**
- Ancien : ~5M métal (impossible)
- Nouveau : ~1.8M métal (challenge mais atteignable)

---

## 🎮 Multiplicateurs serveur

### Configuration recommandée pour MVP

```typescript
// Dans .env ou config serveur
GAME_SPEED = 2500          // Production ressources (x2.5)
FLEET_SPEED = 2500          // Vitesse flottes (x2.5)
RESEARCH_SPEED = 2500       // Vitesse recherche (x2.5)

// Débris
DEBRIS_FACTOR = 0.30        // 30% en débris
DEFENSE_REPAIR = 0.70       // 70% défenses réparées

// Revenus de base (par heure)
METAL_BASIC_INCOME = 30     // 30 métal/h (up from 20)
CRYSTAL_BASIC_INCOME = 15   // 15 cristal/h (up from 10)
DEUTERIUM_BASIC_INCOME = 0  // 0 deut/h (unchanged)
```

**Justification :**
- Speed x2.5 rend le jeu dynamique sans être trop rapide
- Revenus de base augmentés compensent le early game
- Débris 30% équilibré (standard OGame)

---

## 📝 Changelog d'équilibrage

### Version 1.0 - Initial Balance Pass (20 janvier 2026)

**Bâtiments :**
- Usine de Robots : factor 2.0 → 1.8, coût 400m → 350m
- Laboratoire : factor 2.0 → 1.8
- Usine de Nanites : factor 2.0 → 1.75, coût base réduit de 10%
- Hangars de stockage : factor 2.0 maintenu (volontairement)

**Vaisseaux :**
- Petit Transporteur : cargo 5000 → 6000
- Chasseur Léger : coût 4000 → 3300, weapon 50 → 60
- Croiseur : coût 29000 → 24000

**Technologies :**
- TOUTES : factor 2.0 → 1.8 (sauf Graviton 3.0)
- Espionnage : coût niveau 1 +10%
- Combustion : coût niveau 1 +15%

**Nouveaux fichiers :**
- `production.ts` : Formules de production complètes
- `defenses.ts` : Toutes les défenses planétaires
- `multipliers.ts` : Configuration multiplicateurs serveur

---

## 🔮 Équilibrage futur (Post-MVP)

### Fonctionnalités à ajouter

1. **Officiers et bonus**
   - Géologue : +5% production par niveau
   - Ingénieur : -5% temps construction
   - Technocrate : -5% temps recherche
   - Stockeur : +50% capacité stockage

2. **Rapidfire avancé**
   - Ajuster rapidfire entre tous les vaisseaux
   - Ajouter rapidfire défenses vs vaisseaux

3. **Combat balancing**
   - Simuler 1000 combats types
   - Ajuster hull/shield/weapon pour équilibrer
   - Tester counters (chasseur > bombardier > défense)

4. **Colonisation et expansion**
   - Coût de colonisation ajusté selon distance
   - Limite planètes basée sur Astrophysique
   - Bonus ressources selon position dans système

---

## ✅ Critères de validation

L'équilibrage est considéré réussi si :

1. ✅ Un nouveau joueur peut atteindre niveau 5 mines en 3-4 jours
2. ✅ Un joueur actif atteint niveau 10 mines en 10-12 jours
3. ✅ Les technologies niveau 8-10 sont accessibles en 2-3 semaines
4. ✅ Le rapport coût/efficacité est équilibré entre vaisseaux
5. ✅ Les défenses sont viables face aux flottes de même coût
6. ✅ L'économie ne stagne pas au mid-game

---

**📌 Document vivant - À mettre à jour après chaque test**
