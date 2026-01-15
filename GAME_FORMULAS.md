# 🧮 FORMULES DE JEU XNOVA

> Formules extraites du code legacy XNova 0.8 (2008)
> À utiliser comme référence pour la refonte moderne

---

## 📊 CONSTANTES UNIVERS

### Configuration de base
```typescript
// Constantes univers (constants.php:18-26)
MAX_GALAXY_IN_WORLD = 9
MAX_SYSTEM_IN_GALAXY = 499
MAX_PLANET_IN_SYSTEM = 15

// Colonisation
MAX_PLAYER_PLANETS = 21           // Max planètes par joueur
FIELDS_BY_MOONBASIS_LEVEL = 4     // Champs par niveau base lunaire

// Construction
MAX_BUILDING_QUEUE_SIZE = 5       // Max éléments dans file construction

// Stockage
MAX_OVERFLOW = 1.1                // Débordement possible 110%
BASE_STORAGE_SIZE = 1000000       // Stockage de base

// Ressources de départ
BUILD_METAL = 500
BUILD_CRYSTAL = 500
BUILD_DEUTERIUM = 500
```

---

## 💎 SYSTÈME DE RESSOURCES

### 1. Production de ressources

**Formule générale (PlanetResourceUpdate.php:86-115)**

```typescript
// Production par seconde
productionPerSecond = (productionPerHour / 3600) * resourceMultiplier * productionLevel

// Production sur un intervalle de temps
production = productionTime * productionPerSecond

// Production finale avec revenu de base
finalProduction = production + baseIncome

// Avec bonus officier
productionPerHour = baseProduction * (1 + (geologueLevel * 0.05))
```

**Exemple métal :**
```typescript
// Ligne 86-93
MetalProduction = (ProductionTime * (metal_perhour / 3600)) * resourceMultiplier * (0.01 * productionLevel)
MetalBaseProduc = (ProductionTime * (metal_basic_income / 3600)) * resourceMultiplier
MetalTotal = CurrentMetal + MetalProduction + MetalBaseProduc

// Plafonné au stockage max
if (MetalTotal > MaxMetalStorage) {
  MetalTotal = MaxMetalStorage
}
```

**Production des mines (OGame 0.8 - formule typique)**

```typescript
// Production par heure (hors bonus et multiplicateurs)
metalMine = 30 * level * 1.1**level
crystalMine = 20 * level * 1.1**level
deuteriumMine = 10 * level * 1.1**level

// Note : la temperature n'est pas stockee dans le schema actuel,
// donc pas de facteur de temperature pour le deut dans le MVP.
```

**Consommation d'energie des mines**

```typescript
metalMineEnergy = 10 * level * 1.1**level
crystalMineEnergy = 10 * level * 1.1**level
deuteriumMineEnergy = 20 * level * 1.1**level
```

**Production d'energie**

```typescript
solarPlantEnergy = 20 * level * 1.1**level
fusionPlantEnergy = 30 * level * 1.05**level
```

### 2. Stockage

**Formule stockage (PlanetResourceUpdate.php:14-16)**

```typescript
// Stockage de base
baseStorage = BASE_STORAGE_SIZE * (1.5 ** storageLevel)

// Avec bonus officier stockeur
maxStorage = baseStorage * (1 + (stockeurLevel * 0.5))

// Stockage avec overflow (110%)
maxStorageWithOverflow = maxStorage * MAX_OVERFLOW
```

**Exemples :**
```typescript
// Niveau 0 : 1,000,000
// Niveau 1 : 1,500,000
// Niveau 2 : 2,250,000
// Niveau 3 : 3,375,000
// Niveau 4 : 5,062,500
// Formule : 1,000,000 * (1.5 ^ niveau)
```

### 3. Énergie et production

**Calcul production selon énergie disponible (PlanetResourceUpdate.php:64-83)**

```typescript
if (energy_max == 0) {
  // Pas d'énergie = revenus de base uniquement
  metal_perhour = metal_basic_income
  crystal_perhour = crystal_basic_income
  deuterium_perhour = deuterium_basic_income
  productionLevel = 100

} else if (energy_max >= energy_used) {
  // Assez d'énergie = 100% production
  productionLevel = 100

} else {
  // Manque énergie = production réduite proportionnellement
  productionLevel = floor((energy_max / energy_used) * 100)
}

// Clamp entre 0 et 100
productionLevel = Math.max(0, Math.min(100, productionLevel))
```

**Exemple :**
```typescript
// Production 1000/h, energie 80/100 :
// productionLevel = (80 / 100) * 100 = 80%
// production réelle = 1000 * 0.80 = 800/h
```

### 4. Bonus officiers

**Production (PlanetResourceUpdate.php:31-38)**

```typescript
// Géologue : +5% production par niveau
metal_perhour *= (1 + (geologue_level * 0.05))
crystal_perhour *= (1 + (geologue_level * 0.05))
deuterium_perhour *= (1 + (geologue_level * 0.05))

// Ingénieur : +5% énergie par niveau
energy_max *= (1 + (ingenieur_level * 0.05))
energy_used *= (1 + (ingenieur_level * 0.05))
```

**Stockeur (PlanetResourceUpdate.php:14-16)**
```typescript
// +50% stockage par niveau
maxStorage *= (1 + (stockeur_level * 0.5))
```

---

## 🏗️ SYSTÈME DE CONSTRUCTION

### 1. Coût des bâtiments

**Formule exponentielle (GetBuildingPrice.php:30)**

```typescript
// Pour bâtiments et technologies (incrémental)
cost = baseCost * (factor ** currentLevel)

// Exemple Mine de Métal
baseCost = { metal: 60, crystal: 15, deuterium: 0 }
factor = 1.5

// Niveau 0 → 1 : 60 métal, 15 cristal
// Niveau 1 → 2 : 90 métal, 22.5 cristal (arrondi 22)
// Niveau 2 → 3 : 135 métal, 33.75 cristal (arrondi 33)
// Niveau 3 → 4 : 202.5 métal, 50.625 cristal
```

**Calcul détaillé :**
```typescript
function getBuildingCost(building, currentLevel) {
  const baseCost = BUILDINGS[building].cost
  const factor = BUILDINGS[building].factor

  const cost = {
    metal: Math.floor(baseCost.metal * Math.pow(factor, currentLevel)),
    crystal: Math.floor(baseCost.crystal * Math.pow(factor, currentLevel)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(factor, currentLevel)),
    energy: Math.floor(baseCost.energy * Math.pow(factor, currentLevel))
  }

  return cost
}
```

### 2. Valeur de destruction

**Récupération de ressources (GetBuildingPrice.php:35-38)**

```typescript
// Destruction = 1/4 du coût de construction
destructionValue = floor(cost / 2) / 2

// Exemple : coût 1000 métal
// Récupération = floor(1000/2)/2 = 500/2 = 250 métal
```

### 3. Vaisseaux et défenses

**Coût fixe (GetBuildingPrice.php:32)**

```typescript
// Pour vaisseaux et défenses (non-incrémental)
cost = baseCost  // Pas de facteur exponentiel

// Exemple Petit Transporteur
cost = { metal: 2000, crystal: 2000, deuterium: 0 }
```

---

## 🚀 SYSTÈME DE FLOTTES

### Configuration des vaisseaux

**IDs vaisseaux (vars.php:63-76)**

```typescript
const SHIPS = {
  202: 'small_ship_cargo',      // Petit Transporteur
  203: 'big_ship_cargo',         // Grand Transporteur
  204: 'light_hunter',           // Chasseur Léger
  205: 'heavy_hunter',           // Chasseur Lourd
  206: 'crusher',                // Croiseur
  207: 'battle_ship',            // Vaisseau de Bataille
  208: 'colonizer',              // Colon
  209: 'recycler',               // Recycleur
  210: 'spy_sonde',              // Sonde Espionnage
  211: 'bomber_ship',            // Bombardier
  212: 'solar_satelit',          // Satellite Solaire
  213: 'destructor',             // Destructeur
  214: 'dearth_star',            // Étoile de la Mort
  215: 'battleship',             // Traqueur
}
```

### Vitesse et consommation

**Formule vitesse base (typique OGame) :**

```typescript
// Vitesse de base par vaisseau (configs spécifiques)
baseSpeed = {
  202: 5000,    // Petit Transporteur
  203: 7500,    // Grand Transporteur
  204: 12500,   // Chasseur Léger
  205: 10000,   // Chasseur Lourd
  206: 15000,   // Croiseur
  207: 10000,   // Vaisseau Bataille
  208: 2500,    // Colon
  209: 2000,    // Recycleur
  210: 100000000, // Sonde (ultra-rapide)
  // etc.
}

// Vitesse avec technologies
speed = baseSpeed * (1 + (combustion_tech * 0.1))  // Moteurs combustion
speed = baseSpeed * (1 + (impulse_tech * 0.2))     // Moteurs impulsion
speed = baseSpeed * (1 + (hyperspace_tech * 0.3))  // Moteurs hyperespace

// Vitesse flotte = vitesse du vaisseau le plus lent
fleetSpeed = Math.min(...ships.map(s => s.speed))
```

**Calcul temps voyage :**

```typescript
// Distance entre deux points
distance = Math.sqrt(
  (galaxy2 - galaxy1)**2 * 20000 +
  (system2 - system1)**2 * 95 +
  (position2 - position1)**2 * 5
)

// Durée voyage
duration = (35000 / speedPercent) * Math.sqrt(distance * 10 / fleetSpeed) + 10
// speedPercent = 10% à 100% (choix joueur)
```

**Consommation deuterium :**

```typescript
consumption = shipCount * baseConsumption * (distance / 35000) * ((fleetSpeed / 1000) + 1)**2

// baseConsumption varie par vaisseau
// Plus rapide = plus de consommation
```

---

## ⚔️ SYSTÈME DE COMBAT

### Structure combat

**Combat OGame-like (6 rounds max) :**

```typescript
// Statistiques vaisseau/défense
stats = {
  hull: number,        // Points de structure (coque)
  shield: number,      // Bouclier
  weapon: number,      // Arme (dégâts)
}

// Technologies modifient les stats
hull *= (1 + armor_tech * 0.1)
shield *= (1 + shield_tech * 0.1)
weapon *= (1 + weapon_tech * 0.1)
```

### Simulation combat

**Algorithme simplifié :**

```typescript
function simulateCombat(attackers, defenders) {
  let round = 0
  const maxRounds = 6

  while (round < maxRounds && attackers.length > 0 && defenders.length > 0) {
    round++

    // Phase 1 : Attaquants tirent
    for (const attacker of attackers) {
      const target = selectRandomTarget(defenders)
      const damage = attacker.weapon

      // Dégâts absorbés par bouclier
      if (target.shield > 0) {
        target.shield -= damage
        if (target.shield < 0) {
          target.hull += target.shield  // Excès sur coque
          target.shield = 0
        }
      } else {
        target.hull -= damage
      }

      // Destruction si coque <= 0
      if (target.hull <= 0) {
        removeShip(defenders, target)
      }
    }

    // Phase 2 : Défenseurs tirent (même logique)
    // ...

    // Phase 3 : Récupération bouclier (70% par round)
    for (const ship of [...attackers, ...defenders]) {
      ship.shield = Math.min(ship.maxShield, ship.shield + ship.maxShield * 0.7)
    }
  }

  // Déterminer résultat
  if (attackers.length > 0 && defenders.length == 0) return 'attacker_win'
  if (defenders.length > 0 && attackers.length == 0) return 'defender_win'
  return 'draw'
}
```

### Débris et pillage

**Champ de débris :**

```typescript
// 30% du métal et cristal des vaisseaux détruits
debris = {
  metal: Math.floor(totalLostMetal * 0.30),
  crystal: Math.floor(totalLostCrystal * 0.30)
}
// Deuterium jamais dans débris
```

**Pillage :**

```typescript
// Max 50% des ressources disponibles
maxLoot = {
  metal: planet.metal * 0.5,
  crystal: planet.crystal * 0.5,
  deuterium: planet.deuterium * 0.5
}

// Limité par capacité cargo
totalCargo = ships.reduce((sum, ship) => sum + ship.cargo, 0)

// Répartition intelligente (priorité au plus précieux)
loot = distributeResources(maxLoot, totalCargo)
```

---

## 🔬 SYSTÈME RECHERCHE

### IDs Technologies (vars.php:46-61)

```typescript
const TECHNOLOGIES = {
  106: 'spy_tech',                  // Espionnage
  108: 'computer_tech',             // Ordinateur
  109: 'military_tech',             // Militaire
  110: 'defence_tech',              // Défense
  111: 'shield_tech',               // Bouclier
  113: 'energy_tech',               // Énergie
  114: 'hyperspace_tech',           // Hyperespace
  115: 'combustion_tech',           // Combustion
  117: 'impulse_motor_tech',        // Impulsion
  118: 'hyperspace_motor_tech',     // Hyperespace
  120: 'laser_tech',                // Laser
  121: 'ionic_tech',                // Ions
  122: 'buster_tech',               // Plasma
  123: 'intergalactic_tech',        // Intergalactique
  124: 'expedition_tech',           // Expédition
  199: 'graviton_tech',             // Graviton
}
```

### Coûts technologies

**Même formule que bâtiments :**

```typescript
// Coût exponentiel
cost = baseCost * (factor ** currentLevel)

// Exemple Technologie Espionnage
baseCost = { metal: 200, crystal: 1000, deuterium: 200 }
factor = 2.0

// Niveau 1 : 200m, 1000c, 200d
// Niveau 2 : 400m, 2000c, 400d
// Niveau 3 : 800m, 4000c, 800d
// Niveau 4 : 1600m, 8000c, 1600d
```

---

## 🕵️ SYSTÈME ESPIONNAGE

### Calcul niveau espionnage

**Formule (typique OGame) :**

```typescript
// Niveau info révélé
spyLevel = Math.floor(
  Math.log(attackerProbes / defenderProbes) / Math.log(1.5) +
  (attackerSpyTech - defenderSpyTech)
)

// Niveaux information
// 0 : Rien (échec)
// 1 : Ressources uniquement
// 2-3 : + Flottes
// 4-5 : + Défenses
// 6-7 : + Bâtiments
// 8+ : + Technologies
```

**Exemple :**
```typescript
// Attaquant : 5 sondes, spy tech 8
// Défenseur : 1 sonde, spy tech 4
spyLevel = Math.floor(Math.log(5/1) / Math.log(1.5) + (8-4))
spyLevel = Math.floor(1.46 + 4) = 5
// → Révèle : Ressources, Flottes, Défenses
```

### Détection et contre-espionnage

```typescript
// Probabilité détection
detectionChance = (defenderSpyTech - attackerSpyTech) * 0.1

// Si détecté, contre-attaque possible
if (detected && defenderHasFleet) {
  // Combat automatique sonde vs défense
}
```

---

## 🌙 SYSTÈME LUNES

### Création lune

**Probabilité création (après combat avec débris) :**

```typescript
// Chance basée sur taille débris
debrisSize = debris.metal + debris.crystal
moonChance = Math.min(debrisSize / 100000, 0.20)  // Max 20%

// Exemple : 2M débris = 20% chance
// Exemple : 500k débris = 5% chance
```

**Taille lune :**
```typescript
// Aléatoire entre 4000 et 9000 km
moonSize = Math.floor(Math.random() * 5000) + 4000

// Influence nombre de champs constructibles
fields = FIELDS_BY_MOONBASIS_LEVEL * moonbasisLevel
```

---

## 👥 SYSTÈME OFFICIERS

### IDs Officiers (vars.php:90-100)

```typescript
const OFFICERS = {
  601: 'rpg_geologue',      // +5% prod mines par niveau
  602: 'rpg_amiral',        // +% vitesse flottes
  603: 'rpg_ingenieur',     // -% temps construction
  604: 'rpg_technocrate',   // -% temps recherche
  605: 'rpg_constructeur',  // +constructions simultanées
  606: 'rpg_scientifique',  // +niveau labo
  607: 'rpg_stockeur',      // +50% stockage par niveau
  608: 'rpg_defenseur',     // +% défenses
  609: 'rpg_bunker',        // Défenses réparées
  610: 'rpg_espion',        // +niveaux espionnage
  611: 'rpg_commandant',    // +slots flottes
}
```

---

## 📐 FORMULES CALCULÉES

### Durée construction

**Formule typique OGame :**

```typescript
buildTime = (metal + crystal) / (2500 * (1 + roboticsLevel) * 2**naniteLevel)

// Avec bonus
buildTime *= (1 - ingenieurLevel * 0.05)  // -5% par niveau ingénieur

// En secondes
```

### Durée recherche

```typescript
researchTime = (metal + crystal) / (1000 * (1 + labLevel))

// Avec bonus
researchTime *= (1 - technocrateLevel * 0.05)
```

### Capacité cargo

```typescript
const CARGO_CAPACITY = {
  202: 5000,   // Petit Transporteur
  203: 25000,  // Grand Transporteur
  208: 7500,   // Colon
  209: 20000,  // Recycleur
  // Combat ships have smaller cargo
  204: 50,     // Chasseur Léger
  205: 100,    // Chasseur Lourd
  // etc.
}

// Technologie Hyperespace augmente capacité
capacity = baseCargo * (1 + hyperspaceTech * 0.05)
```

---

## 🎮 CONSTANTES DE JEU

### Configuration serveur typique

```typescript
const SERVER_CONFIG = {
  game_speed: 2500,              // Vitesse jeu (production)
  fleet_speed: 2500,             // Vitesse flottes
  resource_multiplier: 1,        // Multiplicateur ressources

  metal_basic_income: 20,        // Revenu de base par heure
  crystal_basic_income: 10,
  deuterium_basic_income: 0,

  initial_fields: 163,           // Champs planète départ

  // Débris
  debris_factor: 0.30,           // 30% en débris

  // Combat
  fleet_to_debris: 0.30,         // 30% flottes → débris
  def_to_debris: 0.00,           // 0% défenses → débris (ou 30%)

  // Réparation
  def_repair_factor: 0.70,       // 70% défenses réparées
}
```

---

## 🔢 EXEMPLES DE CALCULS

### Exemple 1 : Production Mine Métal Niveau 10

```typescript
// Formule production mine métal (typique)
production = 30 * level * 1.1**level

// Niveau 10
production = 30 * 10 * 1.1**10
production = 300 * 2.594
production = 778 métal/heure

// Avec géologue niveau 3 (+15%)
production = 778 * 1.15 = 895 métal/heure

// Avec multiplicateur serveur x2
production = 895 * 2 = 1790 métal/heure
```

### Exemple 2 : Coût Centrale Solaire Niveau 5

```typescript
// Coût de base
baseCost = { metal: 75, crystal: 30 }
factor = 1.5
currentLevel = 5

cost = {
  metal: 75 * 1.5**5 = 75 * 7.59 = 569 métal
  crystal: 30 * 1.5**5 = 30 * 7.59 = 228 cristal
}
```

### Exemple 3 : Temps voyage entre 1:1:1 et 1:5:10

```typescript
// Distance
dGalaxy = (1 - 1) * 20000 = 0
dSystem = (5 - 1) * 95 = 380
dPosition = (10 - 1) * 5 = 45
distance = Math.sqrt(0 + 380 + 45) = 20.6

// Flotte : 10 Petits Transporteurs (vitesse 5000)
// Vitesse 100%
duration = (35000 / 100) * Math.sqrt(20.6 * 10 / 5000) + 10
duration = 350 * Math.sqrt(0.0412) + 10
duration = 350 * 0.203 + 10
duration = 81 secondes ≈ 1min 21s
```

---

## 🎯 NOTES IMPORTANTES

### Conversions TypeScript

Toutes ces formules PHP doivent être converties en TypeScript pour le nouveau projet :

```typescript
// PHP → TypeScript
floor()  → Math.floor()
pow(x,y) → Math.pow(x, y) ou x**y
sqrt()   → Math.sqrt()
log()    → Math.log()
rand()   → Math.random()
```

### Modifications recommandées

**Améliorations possibles :**

1. **Précision :** Utiliser `Decimal.js` pour éviter erreurs arrondis
2. **Équilibrage :** Ajuster factors et multiplicateurs
3. **Bonus :** Revoir bonus officiers (peut-être trop puissants)
4. **Combat :** Implémenter critiques, focus fire, etc.
5. **Performance :** Pré-calculer tables de coûts

### Fichiers de config JSON

**Créer fichiers de configuration :**

```typescript
// packages/game-config/buildings.json
// packages/game-config/technologies.json
// packages/game-config/ships.json
// packages/game-config/defenses.json
```

---

**📌 Ce document est votre référence pour implémenter toute la logique métier du jeu !**

Toutes les formules sont extraites du code legacy et validées.
Utilisez-les comme base pour le nouveau moteur de jeu en TypeScript.
