# 🏆 ROADMAP COMPLÈTE - XNOVA REFORGE

> Version complète du projet XNova avec toutes les fonctionnalités avancées
> **Durée totale :** 6-12 mois | **Base :** MVP (4 mois) + Extensions (2-8 mois)

---

## 📊 Vue d'ensemble

Cette roadmap étend le MVP avec des fonctionnalités avancées pour créer un MMOSTR complet et compétitif.

### Nouvelles fonctionnalités majeures
- 🎯 Combat avancé avec moteur physique
- 💰 Économie complexe (marché, commerce)
- 🕵️ Système d'espionnage complet
- 🌌 Univers persistant multi-galaxies
- 👥 Alliances avancées (diplomatie, ACS)
- 🎮 Événements et méta-jeu
- 📱 Application mobile
- 🎨 Visualisations 3D

---

## 📅 PHASE 5 : Features Avancées (Mois 5-6)

### Module Combat Avancé

**Objectif :** Moteur de combat réaliste avec physique et tactiques

#### Backend - CombatEngine v2
- [ ] Refonte moteur de combat
  ```typescript
  class AdvancedCombatEngine {
    // Simulation physique
    calculateTrajectories()
    applyWeaponEffects()
    processShieldRegeneration()
    handleCriticalHits()

    // IA basique défense
    calculateDefenseFormation()
    prioritizeTargets()
  }
  ```
- [ ] Système de rounds amélioré
  - Max 6 rounds (comme OGame)
  - Tirs simultanés dans un round
  - Focus de tir (cible prioritaire)
  - Critiques (5% chance, 2x dégâts)
- [ ] Technologies militaires
  ```prisma
  model MilitaryTech {
    userId      String
    weaponTech  Int @default(0)  // +10% dégâts par niveau
    shieldTech  Int @default(0)  // +10% bouclier par niveau
    armorTech   Int @default(0)  // +10% coque par niveau
  }
  ```
- [ ] Défenses planétaires
  - Lance-missiles, Artillerie laser
  - Canons Gauss, Canons à ions
  - Canons à plasma, Petits boucliers
  - Grands boucliers, Missile d'interception
  - Missile interplanétaire
- [ ] Réparation automatique
  - Défenses : 70% réparation post-combat
  - Vaisseaux : 0% (détruits = perdus)
- [ ] Champ de débris amélioré
  - 30% metal + 30% crystal des pertes
  - Débris restent 48h
  - Mission recyclage

#### Frontend - UI Combat
- [ ] Replay combat 3D (Three.js)
  - Vaisseaux 3D basiques
  - Trajectoires tirs
  - Explosions particules
  - Camera contrôlable
- [ ] Rapport combat enrichi
  - Timeline tour par tour
  - Graphiques pertes
  - Statistiques détaillées
  - Export JSON/PDF
- [ ] Simulateur de combat
  - Saisie forces attaque/défense
  - Prévisualisation résultat
  - Optimisation flottes
  - Partage simulation (URL)

**Livrables :**
- ✅ Combat réaliste et équilibré
- ✅ Défenses utiles
- ✅ Replay visuel impressionnant

---

### Module Économie

**Objectif :** Système économique complet

#### Backend - Module Market
- [ ] Schema Prisma
  ```prisma
  model MarketOffer {
    id          String   @id @default(uuid())
    sellerId    String
    seller      User     @relation(fields: [sellerId], references: [id])

    resourceType String  // metal, crystal, deuterium
    amount       Float
    pricePerUnit Float
    minAmount    Float   @default(1)

    active       Boolean @default(true)
    createdAt    DateTime @default(now())
    expiresAt    DateTime
  }

  model Trade {
    id        String   @id @default(uuid())
    offerId   String
    buyerId   String
    amount    Float
    totalCost Float
    createdAt DateTime @default(now())
  }

  model Contract {
    id           String   @id @default(uuid())
    issuerId     String
    contractType String   // delivery, defense, attack
    reward       Json
    requirements Json
    status       String   // open, in_progress, completed
    expiresAt    DateTime
  }
  ```
- [ ] Service MarketService
  - Création offres vente
  - Recherche offres
  - Achat ressources
  - Système enchères (optionnel)
  - Taxes transactions (5%)
- [ ] Service ContractService
  - Contrats de livraison (transport ressources)
  - Contrats de défense (stationner flottes)
  - Contrats d'attaque (mercenariat)
  - Système de réputation
- [ ] Commerce NPC
  - Marchands ambulants
  - Prix fluctuants (offre/demande)
  - Événements commerciaux

#### Frontend - UI Economy
- [ ] Page `/market`
  - Liste offres par ressource
  - Filtres (prix, quantité)
  - Graphiques prix historiques
  - Création offre vente
  - Achat instantané
- [ ] Page `/contracts`
  - Liste contrats disponibles
  - Filtres par type/récompense
  - Création contrats
  - Suivi contrats actifs
- [ ] Page `/trade-routes`
  - Automatisation transports
  - Routes commerciales
  - Profits calculés

**Livrables :**
- ✅ Marché fonctionnel
- ✅ Économie dynamique
- ✅ Nouvelles sources revenus

---

### Module Espionnage

**Objectif :** Système d'espionnage complet

#### Backend - Module Spy
- [ ] Schema Prisma
  ```prisma
  model SpyReport {
    id           String   @id @default(uuid())
    spyId        String
    spy          User     @relation("SpyReports", fields: [spyId], references: [id])
    targetId     String
    target       User     @relation("SpiedReports", fields: [targetId], references: [id])

    level        Int      // 0-8 (rien à tout)
    resources    Json?
    fleet        Json?
    defense      Json?
    buildings    Json?
    technologies Json?

    probesLost   Int
    detected     Boolean
    createdAt    DateTime @default(now())
  }
  ```
- [ ] Service SpyService
  - Calcul niveau espionnage
    ```typescript
    spyLevel = Math.floor(
      Math.log(attackerProbes / defenderProbes) / Math.log(1.5) +
      (attackerSpyTech - defenderSpyTech)
    )
    ```
  - Niveaux information :
    - 0: Rien (échec total)
    - 1: Ressources uniquement
    - 2-3: + Flottes
    - 4-5: + Défenses
    - 6-7: + Bâtiments
    - 8: + Technologies
  - Calcul pertes sondes
  - Probabilité détection
  - Contre-espionnage (attaque auto si détecté)
- [ ] Technologie Espionnage (12 niveaux)
- [ ] Phalanx de détection
  - Bâtiment spécial (lune uniquement)
  - Détection mouvements flottes
  - Portée basée sur niveau
  ```typescript
  range = (phalanxLevel - 1)² - 1
  ```

#### Frontend - UI Spy
- [ ] Rapports d'espionnage
  - Formatage par niveau info
  - Indicateur détection
  - Coordonnées cible
  - Boutons actions (attaque, transport)
- [ ] Simulateur espionnage
  - Estimation niveau info
  - Nombre sondes requis
  - Risque détection
- [ ] Phalanx scanner
  - Vue mouvements planète ciblée
  - Infos flottes en approche/retour

**Livrables :**
- ✅ Espionnage fonctionnel
- ✅ Phalanx utile
- ✅ Mécaniques anti-espionnage

---

## 📅 PHASE 6 : Univers Persistant (Mois 7-8)

### Expansion Galactique

**Objectif :** Univers riche et diversifié

#### Backend - Universe Generation
- [ ] Génération procédurale avancée
  ```typescript
  class UniverseGenerator {
    generateGalaxies(count: 9) {
      // Chaque galaxie : caractéristiques uniques
      // Galaxie 1: Standard
      // Galaxie 9: Dangereuse (pirates +200%)
    }

    generateSystems(galaxyId, count: 499) {
      // Distribution planètes
      // Zones riches en ressources
      // Systèmes abandonnés
    }

    generatePhenomena() {
      // Nébuleuses (réduction vitesse 50%)
      // Champs d'astéroïdes (bonus recyclage)
      // Trous noirs (téléportation)
    }
  }
  ```
- [ ] Schema Prisma étendu
  ```prisma
  model GalacticPhenomenon {
    id       String @id @default(uuid())
    type     String // nebula, asteroid_field, black_hole
    galaxy   Int
    system   Int
    effects  Json
  }

  model JumpGate {
    id          String @id @default(uuid())
    planetId    String @unique
    planet      Planet @relation(fields: [planetId], references: [id])
    level       Int
    linkedGates String[] // IDs autres jumpgates
  }

  model Territory {
    id         String   @id @default(uuid())
    allianceId String
    alliance   Alliance @relation(fields: [allianceId], references: [id])
    galaxy     Int
    systemMin  Int
    systemMax  Int
    claimedAt  DateTime @default(now())
  }
  ```
- [ ] Zones PvP/PvE
  - Zones protégées (débutants < 10k points)
  - Zones neutres (PvP autorisé)
  - Zones de guerre (bonus pillage +50%)
- [ ] Portail de saut (Jumpgate)
  - Construction sur planète/lune
  - Liaison avec autre jumpgate
  - Téléportation flottes instantanée
  - Cooldown 1h
  - Coût deuterium par saut
- [ ] Expéditions spatiales
  - Mission aléatoire (exploration)
  - Récompenses :
    - Ressources (40%)
    - Vaisseaux (20%)
    - Items (10%)
    - Rien (20%)
    - Combat pirates (10%)
  - Durée variable
  - Requiert Technologie Expédition

#### Frontend - UI Universe
- [ ] Carte galaxie 3D
  - Vue 3D galaxies (Three.js)
  - Zoom galaxie → système → planète
  - Visualisation territoires alliances
  - Filtres (alliés, ennemis, inactifs)
- [ ] Phénomènes galactiques
  - Icônes spéciaux sur carte
  - Tooltips effets
  - Animations (nébuleuses animées)
- [ ] Gestion jumpgate
  - Interface liaison
  - Liste destinations disponibles
  - Calcul coût saut

**Livrables :**
- ✅ Univers vivant et varié
- ✅ Nouvelles mécaniques stratégiques
- ✅ Visualisation impressionnante

---

### Colonisation Avancée

**Objectif :** Expansion planétaire enrichie

#### Backend - Colonization v2
- [ ] Lunes
  ```prisma
  model Moon {
    id          String  @id @default(uuid())
    planetId    String  @unique
    planet      Planet  @relation(fields: [planetId], references: [id])

    name        String
    size        Int     // 4000-9000 km
    temperature Int

    // Bâtiments spéciaux lune
    phalanx     Int     @default(0)
    jumpGate    Int     @default(0)
  }
  ```
- [ ] Création lunes
  - Probabilité après combat (débris > 1M)
  - Formule : `chance = min(débris/100000, 20%)`
  - Taille aléatoire (influence champs)
- [ ] Types de planètes
  ```typescript
  enum PlanetType {
    NORMAL,      // Production standard
    DESERT,      // +20% solar, -10% deuterium
    JUNGLE,      // +15% crystal
    ICE,         // +30% deuterium, -20% solar
    VOLCANIC,    // +25% metal, -15% crystal
    GAS_GIANT    // +50% deuterium (colonisation difficile)
  }
  ```
- [ ] Terraformation
  - Augmentation champs constructibles
  - Coût exponentiel
  - Limite basée sur température planète
- [ ] Abandon et migration
  - Abandon planète (récupère 33% ressources)
  - Migration population (bonus production)
  - Cooldown 48h

#### Frontend - UI Colonization
- [ ] Page planète enrichie
  - Affichage type planète
  - Bonus/malus production
  - Météo spatiale
- [ ] Gestion multi-planètes
  - Switch rapide entre planètes
  - Vue d'ensemble (dashboard toutes planètes)
  - Groupes planètes (production, militaire)
- [ ] Lune
  - Vue séparée
  - Bâtiments spéciaux uniquement

**Livrables :**
- ✅ Lunes fonctionnelles
- ✅ Diversité planétaire
- ✅ Gestion avancée colonies

---

### Officiers & Héros

**Objectif :** Personnages donnant bonus permanents

#### Backend - Module Officers
- [ ] Schema Prisma
  ```prisma
  model Officer {
    id          String   @id @default(uuid())
    userId      String
    user        User     @relation(fields: [userId], references: [id])

    type        String   // commander, admiral, engineer, geologist, technocrat
    level       Int      @default(1)
    experience  Int      @default(0)

    activeUntil DateTime?
  }

  model FleetCommander {
    id       String @id @default(uuid())
    fleetId  String @unique
    fleet    Fleet  @relation(fields: [fleetId], references: [id])

    name     String
    level    Int    @default(1)
    skills   Json   // { "attack": 5, "defense": 3, "speed": 2 }
  }
  ```
- [ ] Types d'officiers (passifs)
  - **Commandant** : +10% production énergie, +2 constructions simultanées
  - **Amiral** : +10% vitesse flottes, +2 expéditions
  - **Ingénieur** : -10% durée constructions, +10 champs
  - **Géologue** : +10% production mines, +10% stockage
  - **Technocrate** : -10% durée recherches, +2 niveaux espionnage
- [ ] Commandants de flottes (actifs)
  - Assignables à une flotte
  - Compétences :
    - Attaque (+1-10% dégâts)
    - Défense (+1-10% bouclier/coque)
    - Vitesse (+1-10% vitesse)
    - Cargo (+1-10% capacité)
  - Gain XP par combat
  - Level up → points compétence
  - Mort possible si flotte détruite (10% chance)
- [ ] Système progression
  ```typescript
  experienceToLevel(level) {
    return Math.floor(1000 * Math.pow(1.5, level - 1))
  }
  ```

#### Frontend - UI Officers
- [ ] Page `/officers`
  - Liste officiers disponibles
  - Achat/activation officier
  - Progression XP
  - Bonus actifs affichés
- [ ] Gestion commandants
  - Liste commandants
  - Assignation flotte
  - Arbre compétences
  - Équipements (optionnel)

**Livrables :**
- ✅ Officiers fonctionnels
- ✅ Commandants avec progression
- ✅ Méta-jeu RPG-lite

---

## 📅 PHASE 7 : Gameplay Profond (Mois 9-10)

### Alliances Avancées

**Objectif :** Système d'alliance complet

#### Backend - Alliance v2
- [ ] Schema Prisma étendu
  ```prisma
  model Alliance {
    id             String   @id @default(uuid())
    tag            String   @unique
    name           String
    founderId      String
    founder        User     @relation(fields: [founderId], references: [id])

    description    String?
    logo           String?
    website        String?

    level          Int      @default(1)
    experience     Int      @default(0)

    treasury       Json     @default("{ metal: 0, crystal: 0, deuterium: 0 }")
    taxRate        Int      @default(0) // 0-20%
  }

  model AllianceMember {
    id           String   @id @default(uuid())
    allianceId   String
    userId       String

    rank         String   // founder, leader, officer, member, recruit
    permissions  Json     // { canInvite: true, canKick: false, ... }
    joinedAt     DateTime @default(now())
  }

  model AllianceDiplomacy {
    id           String   @id @default(uuid())
    allianceId   String
    alliance     Alliance @relation(fields: [allianceId], references: [id])
    targetId     String
    target       Alliance @relation(fields: [targetId], references: [id])

    status       String   // war, nap, ally
    startDate    DateTime
    endDate      DateTime?
  }

  model ACS {
    id          String   @id @default(uuid())
    ownerId     String
    name        String

    targetGalaxy   Int
    targetSystem   Int
    targetPosition Int

    arrivalTime DateTime
    fleets      Json[]   // Liste fleetIds participants
  }
  ```
- [ ] Service AllianceService v2
  - Hiérarchie rangs customisables
  - Permissions granulaires (40+ actions)
  - Trésorerie commune (taxes auto)
  - Diplomatie (guerre, NAP, alliance)
  - Quartier général (bâtiments alliance)
- [ ] ACS (Alliance Combat System)
  - Attaques groupées synchronisées
  - Partage loot proportionnel
  - Rapport combat unifié
  - Coordination temps réel
- [ ] Messages alliance
  - Broadcasts
  - Circulaires
  - Messages rangs spécifiques
- [ ] Guerres d'alliance
  - Déclaration formelle
  - Conditions victoire
  - Système de points guerre
  - Récompenses fin guerre

#### Frontend - UI Alliance
- [ ] Page alliance complète
  - Onglets : Membres, Diplomatie, Trésor, QG, Territoire
  - Gestion rangs et permissions
  - Forum interne
  - Chat temps réel (Socket.io)
  - Calendrier événements
- [ ] Interface ACS
  - Création attaque groupée
  - Invitation membres alliance
  - Synchronisation flottes
  - Countdown coordonné
- [ ] Guerres
  - Tableau scores
  - Leaderboard combattants
  - Historique batailles

**Livrables :**
- ✅ Alliances riches en features
- ✅ Diplomatie fonctionnelle
- ✅ ACS opérationnel

---

### Événements & Méta-jeu

**Objectif :** Contenu dynamique et rejouabilité

#### Backend - Module Events
- [ ] Schema Prisma
  ```prisma
  model Event {
    id          String   @id @default(uuid())
    type        String   // seasonal, boss, invasion, tournament
    name        String
    description String

    startDate   DateTime
    endDate     DateTime

    rewards     Json
    participants Json[]

    active      Boolean  @default(true)
  }

  model Quest {
    id          String @id @default(uuid())
    type        String // daily, weekly, seasonal

    objective   String
    target      Int
    reward      Json

    resetAt     DateTime
  }

  model Achievement {
    id          String @id @default(uuid())
    userId      String

    achievementId String
    unlockedAt    DateTime @default(now())
  }

  model Season {
    id          String   @id @default(uuid())
    number      Int
    startDate   DateTime
    endDate     DateTime

    rewards     Json
    leaderboard Json
  }
  ```
- [ ] Événements saisonniers
  - Été : Bonus production +50%
  - Automne : Bonus vitesse flottes +30%
  - Hiver : Bonus défense +40%
  - Printemps : Bonus recyclage +25%
- [ ] Boss galactiques (PvE)
  - Spawn aléatoire dans univers
  - Mega-flotte NPC
  - Attaque collaborative (toute alliance)
  - Loot épique (ressources massives, items)
- [ ] Invasions aliens
  - Vagues d'attaques NPC
  - Défense collaborative serveur
  - Récompenses globales
- [ ] Expéditions améliorées
  - Trésors cachés
  - Rencontres événements
  - Items rares
- [ ] Quêtes journalières/hebdomadaires
  ```typescript
  dailyQuests = [
    { objective: "Construire 5 bâtiments", reward: { metal: 10000 } },
    { objective: "Gagner 3 combats", reward: { deuterium: 5000 } },
    { objective: "Espionner 10 planètes", reward: { crystal: 7500 } }
  ]
  ```
- [ ] Achievements (100+)
  - Progression (atteindre niveau X)
  - Combat (gagner X batailles)
  - Économie (accumuler X ressources)
  - Exploration (coloniser X planètes)
  - Social (rejoindre alliance, recruter)
- [ ] Saisons compétitives
  - Durée 3 mois
  - Classements séparés
  - Récompenses exclusives
  - Reset partiel optionnel

#### Frontend - UI Events
- [ ] Dashboard événements
  - Événements actifs
  - Countdown
  - Progression
  - Leaderboards
- [ ] Page quêtes
  - Liste daily/weekly
  - Progression
  - Réclamer récompenses
  - Historique
- [ ] Page achievements
  - Grille achievements
  - Catégories
  - Pourcentage complétion
  - Partage social
- [ ] Saisons
  - Classement saison
  - Récompenses paliers
  - Progression personnelle

**Livrables :**
- ✅ Contenu dynamique constant
- ✅ Rejouabilité élevée
- ✅ Engagement long terme

---

### Système de Progression

**Objectif :** Méta-progression joueur

#### Backend - Progression
- [ ] Schema Prisma
  ```prisma
  model PlayerProfile {
    id          String @id @default(uuid())
    userId      String @unique
    user        User   @relation(fields: [userId], references: [id])

    level       Int    @default(1)
    experience  Int    @default(0)
    skillPoints Int    @default(0)

    specialization String? // miner, warrior, trader, explorer

    prestigeLevel  Int @default(0)
    prestigePoints Int @default(0)
  }

  model SkillTree {
    id       String @id @default(uuid())
    userId   String

    // Branches
    mining        Int @default(0) // +% production
    military      Int @default(0) // +% combat
    research      Int @default(0) // -% durée tech
    economy       Int @default(0) // -% coûts
    exploration   Int @default(0) // +% expéditions
  }
  ```
- [ ] Système de niveaux joueur
  - Gain XP par actions
  - Level up → skill points
  - Paliers spéciaux (déblocages)
- [ ] Arbre de compétences
  - 5 branches (mining, military, research, economy, exploration)
  - 20 niveaux par branche
  - Synergies entre branches
  - Respec possible (coût)
- [ ] Spécialisations
  - Choix niveau 10
  - Bonus passifs puissants
  - **Mineur** : +30% production, +20 champs
  - **Guerrier** : +20% dégâts, -20% pertes
  - **Commerçant** : -50% taxes marché, +30% profits
  - **Explorateur** : +50% récompenses expéditions, +2 planètes max
- [ ] Prestige
  - Reset après atteinte niveau max
  - Conserve : Technologies, Officiers, Cosmétiques
  - Perd : Planètes, Flottes, Ressources
  - Gains : Points prestige (bonus permanents)

#### Frontend - UI Progression
- [ ] Page profil joueur
  - Niveau et XP
  - Statistiques globales
  - Spécialisation
  - Prestige
- [ ] Arbre compétences interactif
  - Visualisation graphique
  - Paths de progression
  - Tooltips détaillés
  - Simulation builds

**Livrables :**
- ✅ Progression satisfaisante
- ✅ Builds variés
- ✅ Rejouabilité prestige

---

## 📅 PHASE 8 : Expérience Utilisateur (Mois 11-12)

### UI/UX Avancée

**Objectif :** Interface moderne et personnalisable

#### Frontend - Modern UI
- [ ] Dashboard personnalisable
  - Widgets drag-and-drop
  - Grille customisable
  - Sauvegarde layouts
  - Widgets disponibles :
    - Ressources temps réel
    - Files constructions
    - Flottes en cours
    - Messages non lus
    - Prochains événements
    - Classements
- [ ] Sélecteur de langue
  - Bouton drapeau FR en haut à droite
  - Langues disponibles : Français, Anglais, Espagnol
  - Traductions UI complètes
  - Fichiers JSON par langue (dossier `locales/`)
- [ ] Thèmes customisables
  - Dark mode / Light mode
  - Thèmes presets (Cyber, Space, Classic)
  - Customisation couleurs (palette)
  - Import/export thèmes
- [ ] Raccourcis clavier
  - Navigation rapide (G+P = planète, G+F = flottes)
  - Actions rapides (B = build, R = research)
  - Customisables
- [ ] Application mobile
  - React Native ou PWA
  - Fonctionnalités essentielles
  - Notifications push
  - Mode hors-ligne (lecture)
- [ ] Macros autorisées
  - Automation basique (legal)
  - Sauvegarde flottes
  - Templates messages
  - Rappels

#### Design System
- [ ] Bibliothèque composants complète
- [ ] Animations fluides (60 FPS)
- [ ] Transitions pages
- [ ] Micro-interactions
- [ ] Feedback haptic (mobile)

**Livrables :**
- ✅ Interface moderne
- ✅ UX optimale
- ✅ Accessibilité mobile

---

### Visualisations 3D

**Objectif :** Immersion visuelle

#### Frontend - 3D Features
- [ ] Vue galaxie 3D (Three.js)
  - Navigation 3D fluide
  - Zoom planètes
  - Particules étoiles
  - Rotations réalistes
- [ ] Planètes 3D
  - Sphères texturées
  - Rotation propre
  - Atmosphère (shader)
  - Nuages animés
- [ ] Combats 3D
  - Replay battles
  - Vaisseaux 3D low-poly
  - Effets lasers/explosions
  - Trajectoires
- [ ] Vaisseaux 3D viewer
  - Vue 360° vaisseaux
  - Zoom détails
  - Informations stats
- [ ] Effets spatiaux
  - Nébuleuses volumétriques
  - Champs astéroïdes
  - Trous noirs (distorsion)
  - Portails de saut

**Stack 3D :**
```typescript
- Three.js (moteur 3D)
- @react-three/fiber (React wrapper)
- @react-three/drei (helpers)
- @react-three/postprocessing (effets)
- GSAP (animations)
```

**Livrables :**
- ✅ Visualisations impressionnantes
- ✅ Performance maintenue
- ✅ Immersion maximale

---

### Tutoriel & Onboarding

**Objectif :** Expérience débutant parfaite

#### Tutoriel interactif
- [ ] Mode tutoriel (15-20 min)
  - Étape 1 : Première connexion, vue planète
  - Étape 2 : Build première mine
  - Étape 3 : Comprendre ressources
  - Étape 4 : Build centrale solaire
  - Étape 5 : Lancer première recherche
  - Étape 6 : Build hangar + vaisseaux
  - Étape 7 : Envoyer première flotte
  - Étape 8 : Premier combat (NPC)
  - Étape 9 : Rejoindre alliance
  - Étape 10 : Exploration galaxie
- [ ] Tooltips contextuels
  - Affichage automatique (première fois)
  - Explications claires
  - Désactivables
- [ ] Académie (wiki intégré)
  - Guide complet jeu
  - Mécaniques expliquées
  - Stratégies avancées
  - FAQ
  - Recherche
- [ ] Outils intégrés
  - **Simulateur combat**
    - Saisie forces
    - Calcul résultat
    - Statistiques détaillées
  - **Calculateur distance**
    - Temps voyage
    - Consommation deuterium
  - **Calculateur production**
    - Prévision production
    - ROI bâtiments
  - **Calculateur recyclage**
    - Débris estimés
    - Recycleurs requis

#### NPE (New Player Experience)
- [ ] Missions guidées (premières heures)
- [ ] Récompenses progression
- [ ] Protection débutants (7 jours)
- [ ] Mentor système (vétérans aident nouveaux)

**Livrables :**
- ✅ Onboarding fluide
- ✅ Taux rétention élevé
- ✅ Courbe apprentissage douce

---

### Administration

**Objectif :** Outils admin complets
**Note :** Reproduire l'intégralité du panel admin XNova 0.8 (menus, écrans, modules).

#### Backend - Admin Module
- [ ] Schema Prisma
  ```prisma
  model AdminLog {
    id        String   @id @default(uuid())
    adminId   String
    action    String
    target    String?
    details   Json
    createdAt DateTime @default(now())
  }

  model Ban {
    id        String   @id @default(uuid())
    userId    String
    adminId   String
    reason    String
    duration  Int?     // null = permanent
    createdAt DateTime @default(now())
    expiresAt DateTime?
  }
  ```
- [ ] Endpoints admin
  - `GET /admin/users` (liste + search)
  - `POST /admin/users/:id/ban`
  - `POST /admin/users/:id/kick`
  - `POST /admin/users/:id/edit`
  - `GET /admin/logs`
  - `GET /admin/stats`
  - `POST /admin/broadcast`
  - `POST /admin/config` (live config)

#### Frontend - Admin Panel
- [ ] Dashboard React Admin
  - Statistiques serveur
  - Graphiques temps réel
  - Alertes (pics CPU, erreurs)
- [ ] Parité panel XNova 0.8 (toutes sections admin historiques)
  - [ ] Vue generale (infos serveur, version, online)
  - [ ] Configuration serveur (vitesses, taille planetes, production)
  - [ ] Remise a zero (reset joueurs/serveur)
  - [ ] Liste des joueurs
  - [ ] Chercher un joueur (profil + stats)
  - [ ] Ajout de ressources
  - [ ] Liste des planetes
  - [ ] Planetes actives
  - [ ] Liste des lunes
  - [ ] Ajout de lunes
  - [ ] Flottes en vol
  - [ ] Bannir un joueur
  - [ ] Debannir un joueur
  - [ ] Administration chat
  - [ ] Actualiser points
  - [ ] Liste des messages
  - [ ] Outil cryptage
  - [ ] Queue fabrication
  - [ ] Erreurs
  - [ ] Forum d'aide
- [ ] Communication email admin
  - [ ] Ajout d'adresse expéditeur (IMAP/POP3)
  - [ ] Configuration boite mail (IMAP/POP3)
  - [ ] Templates mails (texte + HTML)
  - [ ] Éditeur message (HTML collable ou texte simple)
  - [ ] Notifications auto (inscription, nouveautés, maintenance)
  - [ ] Envoi massif (admins / modérateurs / joueurs)
- [ ] Gestion utilisateurs
  - Liste complète
  - Recherche avancée
  - Édition inline
  - Actions bulk
- [ ] Modération
  - Reports joueurs
  - Chat logs
  - Ban/kick/mute
  - Historique sanctions
- [ ] Outils GM (Game Master)
  - Ajout ressources
  - Déplacement flottes
  - Spawn vaisseaux
  - Édition planètes
  - Simulation événements
- [ ] Configuration live
  - Paramètres serveur
  - Multiplicateurs (prod, vitesse)
  - Activation/désactivation features
  - Maintenance mode
- [ ] Logs et audit
  - Logs actions admin
  - Logs transactions
  - Logs combats
  - Export CSV

**Livrables :**
- ✅ Administration efficace
- ✅ Modération rapide
- ✅ Auditabilité complète

---

## 📅 PHASE 9 : Scale & Performance (En continu)

### Infrastructure Production

**Objectif :** Support 5000+ joueurs simultanés

#### Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xnova-api
spec:
  replicas: 5
  selector:
    matchLabels:
      app: xnova-api
  template:
    spec:
      containers:
      - name: api
        image: xnova/api:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
---
# Load Balancer
apiVersion: v1
kind: Service
metadata:
  name: xnova-lb
spec:
  type: LoadBalancer
  selector:
    app: xnova-api
  ports:
  - port: 80
    targetPort: 3001
```

#### Database Scaling
- [ ] PostgreSQL optimizations
  - Indexes stratégiques
  - Partitioning tables (fleets, messages)
  - Vacuum automatique
- [ ] Read Replicas
  - 2-3 replicas lecture
  - Load balancing reads
- [ ] Connection pooling (PgBouncer)
- [ ] Query optimization
  - Slow query logs
  - EXPLAIN ANALYZE
  - N+1 elimination

#### Redis Cluster
- [ ] Configuration cluster (3+ nodes)
- [ ] Sharding par type données
- [ ] Failover automatique
- [ ] Persistence (AOF)

#### CDN & Assets
- [ ] Cloudflare CDN
  - Images, CSS, JS
  - GZIP/Brotli compression
  - HTTP/3
- [ ] Image optimization
  - WebP/AVIF formats
  - Lazy loading
  - Responsive images

#### Message Queue
- [ ] RabbitMQ/Kafka pour jobs lourds
  - Calculs combats
  - Génération rapports
  - Envoi emails
  - Notifications push

#### Microservices (optionnel)
- [ ] Séparation services
  - `combat-service` (calculs lourds)
  - `fleet-service` (gestion déplacements)
  - `notification-service` (push, emails)
- [ ] Communication gRPC
- [ ] Service mesh (Istio)

**Livrables :**
- ✅ Scalabilité horizontale
- ✅ Haute disponibilité (99.9%)
- ✅ Performance optimale

---

### Monitoring & Analytics

**Objectif :** Visibilité complète système et utilisateurs

#### APM (Application Performance Monitoring)
- [ ] New Relic / Datadog
  - Latency tracking
  - Error rate
  - Throughput
  - Apdex score
- [ ] Distributed tracing
  - Request flows
  - Bottleneck identification

#### Metrics & Alerting
- [ ] Prometheus + Grafana
  - Dashboards custom
  - Métriques business
  - Alertes (Slack/Discord)
- [ ] Métriques clés :
  ```typescript
  // System
  - API latency (p50, p95, p99)
  - Database connections
  - Redis hit rate
  - Error rate
  - Request rate

  // Business
  - Active users (DAU, MAU)
  - Retention (D1, D7, D30)
  - ARPU (si monétisation)
  - Conversions
  - Churn rate
  ```

#### User Analytics
- [ ] Mixpanel / Amplitude
  - Event tracking
  - Funnels
  - Cohorts
  - Retention curves
- [ ] Événements trackés :
  - Inscription
  - Premier build
  - Première recherche
  - Premier combat
  - Join alliance
  - Achat (si monétisation)

#### Business Intelligence
- [ ] Data warehouse (BigQuery/Snowflake)
- [ ] ETL pipelines
- [ ] Rapports automatisés
- [ ] Prédictions ML
  - Churn prediction
  - Recommandations

**Livrables :**
- ✅ Monitoring complet
- ✅ Alerting proactif
- ✅ Data-driven decisions

---

### Sécurité

**Objectif :** Sécurité production-grade

#### Audit Sécurité
- [ ] Penetration testing
- [ ] Code audit (SonarQube)
- [ ] Dependency scanning (Snyk)
- [ ] OWASP Top 10 compliance
- [ ] Security headers (Content-Security-Policy, etc.)

#### Anti-Cheat
- [ ] Détection patterns suspects
  - Actions trop rapides
  - Patterns bots
  - Multi-comptes
- [ ] Rate limiting granulaire
- [ ] CAPTCHA sur actions sensibles
- [ ] Fingerprinting navigateur
- [ ] Logs détaillés actions

#### Protection Infrastructure
- [ ] DDoS protection (Cloudflare)
- [ ] WAF (Web Application Firewall)
- [ ] Fail2ban
- [ ] IP whitelisting admin

#### Compliance
- [ ] GDPR compliance
  - Export données utilisateur
  - Suppression compte
  - Consentement cookies
  - Privacy policy
- [ ] Encryption at rest
- [ ] Encryption in transit (TLS 1.3)
- [ ] Secret management (Vault)

#### Bug Bounty
- [ ] Programme bug bounty (HackerOne)
- [ ] Récompenses selon sévérité
- [ ] Responsible disclosure policy

**Livrables :**
- ✅ Sécurité maximale
- ✅ Protection anti-cheat
- ✅ Compliance légale

---

## 🎯 Comparaison MVP vs COMPLET

| Feature | MVP | COMPLET |
|---------|-----|---------|
| **Combat** | Basique tour par tour | Moteur avancé + Replay 3D |
| **Économie** | Ressources simples | Marché + Commerce + Contrats |
| **Espionnage** | ❌ Absent | ✅ Complet (8 niveaux + Phalanx) |
| **Univers** | 1 galaxie basique | 9 galaxies + Phénomènes + Jumpgates |
| **Colonisation** | Planètes standards | Lunes + Types planètes + Terraformation |
| **Alliances** | Basique | Diplomatie + ACS + Guerres + QG |
| **Événements** | ❌ Absent | Boss + Invasions + Quêtes + Saisons |
| **Progression** | Linéaire | Niveaux + Skills + Spécialisations + Prestige |
| **UI/UX** | Fonctionnelle | 3D + Customisable + Mobile + Widgets |
| **Officiers** | ❌ Absent | 5 types + Commandants flottes |
| **Admin** | Basique | Panel complet + GM tools + Logs |
| **Infrastructure** | 100-500 joueurs | 5000+ joueurs (K8s) |
| **Monitoring** | Basique (Sentry) | APM + Analytics + BI |
| **Sécurité** | Standard | Audit + Anti-cheat + Bug bounty |

---

## 💰 Modèle de Monétisation (Optionnel)

### Freemium Éthique (NO Pay-to-Win)

#### Cosmétiques uniquement
- [ ] Skins planètes
- [ ] Thèmes UI premium
- [ ] Avatars custom
- [ ] Effets visuels flottes
- [ ] Badges profil

#### Commodité (non-P2W)
- [ ] Officiers premium (même puissance, visuels différents)
- [ ] Slots planètes supplémentaires (+1-2)
- [ ] Rename planète/alliance
- [ ] Chat colors

#### Abonnement Premium (optionnel)
- [ ] Premium tier ($5/mois)
  - +10% XP gain
  - Accès beta features
  - Badge exclusive
  - Support prioritaire
  - Pas d'avantage gameplay significatif

**Règle d'or :** Aucun avantage Pay-to-Win !

---

## 📚 Documentation Complète

### Pour Développeurs
- [ ] README détaillé
- [ ] Architecture Decision Records (ADR)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema docs
- [ ] Code comments (JSDoc)
- [ ] Contributing guide
- [ ] Code of conduct

### Pour Joueurs
- [ ] Guide débutant complet
- [ ] Wiki communautaire
- [ ] FAQ extensive
- [ ] Tutoriels vidéo
- [ ] Changelog détaillé
- [ ] Formules de jeu documentées

### Pour Admins
- [ ] Deployment guide
- [ ] Backup & restore procedures
- [ ] Troubleshooting guide
- [ ] Scaling guide
- [ ] Security best practices

---

## 🚀 Lancement Production

### Pre-Launch Checklist
- [ ] Tous tests passent (unit, integration, E2E)
- [ ] Load testing (5000+ users)
- [ ] Security audit complet
- [ ] Performance optimisée
- [ ] Monitoring configuré
- [ ] Backups automatiques actifs
- [ ] Documentation complète
- [ ] Support tickets système
- [ ] Landing page marketing
- [ ] Communauté Discord/Forum

### Lancement Soft (Beta)
- [ ] Invitation limitée (500 joueurs)
- [ ] Feedback gathering
- [ ] Bug fixing rapide
- [ ] Balance adjustments
- [ ] Performance monitoring

### Lancement Public
- [ ] Marketing campaign
- [ ] Press release
- [ ] Streamers partnership
- [ ] Open registration
- [ ] Support 24/7
- [ ] Événement lancement (bonus ressources)

---

## 🎉 Post-Launch (Maintenance Continue)

### Hebdomadaire
- [ ] Événements communautaires
- [ ] Équilibrage patches
- [ ] Bug fixes
- [ ] Modération

### Mensuel
- [ ] Nouvelle saison compétitive
- [ ] Nouveaux achievements
- [ ] Balance majeure
- [ ] Nouvelles quêtes

### Trimestriel
- [ ] Nouveau contenu majeur
  - Nouveaux vaisseaux
  - Nouvelles technologies
  - Nouveaux bâtiments
- [ ] Features majeures
- [ ] Événements saisonniers

### Annuel
- [ ] Expansion majeure
  - Nouvelle galaxie
  - Nouveau gameplay mode
- [ ] Refonte graphique
- [ ] Migration technologique

---

## 📊 KPIs Succès (Version Complète)

### Engagement
- **DAU** : 2000+ joueurs actifs/jour
- **MAU** : 8000+ joueurs actifs/mois
- **Retention D30** : >40%
- **Session duration** : >45 min moyenne
- **Sessions/jour** : >3 par joueur actif

### Performance
- **Uptime** : >99.9%
- **API latency p95** : <150ms
- **Page load time** : <2s
- **Error rate** : <0.1%

### Communauté
- **Alliances actives** : 100+
- **Messages/jour** : 10000+
- **Combats/jour** : 5000+
- **Discord members** : 5000+

### Business (si monétisé)
- **Conversion rate** : >5%
- **ARPU** : >$2/mois
- **LTV** : >$50
- **Churn rate** : <10%/mois

---

## 🛠️ Stack Technique Finale

### Backend
```json
{
  "runtime": "Bun 1.0+",
  "framework": "NestJS 10+",
  "orm": "Prisma 5+",
  "database": "PostgreSQL 16",
  "cache": "Redis 7 (Cluster)",
  "queue": "BullMQ / RabbitMQ",
  "websocket": "Socket.io 4+",
  "validation": "Zod / class-validator",
  "auth": "JWT + Argon2"
}
```

### Frontend
```json
{
  "framework": "Next.js 15+",
  "language": "TypeScript 5+",
  "styling": "TailwindCSS 4+",
  "components": "shadcn/ui + Radix UI",
  "state": "Zustand 4+",
  "data-fetching": "React Query 5+",
  "animations": "Framer Motion 11+",
  "3d": "Three.js + React Three Fiber",
  "forms": "React Hook Form + Zod"
}
```

### Mobile (Phase 8)
```json
{
  "approach": "PWA (priorité) ou React Native",
  "offline": "Service Workers",
  "notifications": "Firebase Cloud Messaging"
}
```

### Infrastructure
```json
{
  "orchestration": "Kubernetes",
  "ci-cd": "GitHub Actions",
  "hosting-api": "Railway / DigitalOcean",
  "hosting-web": "Vercel",
  "cdn": "Cloudflare",
  "monitoring": "Datadog / New Relic",
  "logging": "Better Stack / Loki",
  "errors": "Sentry",
  "analytics": "Mixpanel / Amplitude"
}
```

### DevOps
```json
{
  "containers": "Docker + Docker Compose",
  "reverse-proxy": "Nginx / Traefik",
  "ssl": "Let's Encrypt (auto-renewal)",
  "backups": "Automated daily (S3)",
  "secrets": "HashiCorp Vault / Doppler"
}
```

---

## ✅ Checklist Finale Version Complète

### Fonctionnalités (100%)
- [x] Toutes features MVP
- [x] Combat avancé + Replay 3D
- [x] Économie complète (marché, contrats)
- [x] Espionnage 8 niveaux + Phalanx
- [x] 9 galaxies + Phénomènes
- [x] Lunes + Types planètes
- [x] Officiers + Commandants
- [x] Alliances avancées + ACS
- [x] Événements + Quêtes + Saisons
- [x] Progression + Skills + Prestige
- [x] UI 3D + Mobile + Customisable
- [x] Admin panel complet

### Qualité
- [x] Tests coverage >85%
- [x] Load tested 5000+ users
- [x] Security audit passed
- [x] Performance optimized
- [x] Accessibility WCAG 2.1
- [x] SEO optimized
- [x] Documentation complète

### Infrastructure
- [x] Kubernetes deployment
- [x] Auto-scaling configuré
- [x] CDN global
- [x] Backups automatiques
- [x] Disaster recovery plan
- [x] Monitoring 24/7
- [x] Uptime >99.9%

### Légal & Compliance
- [x] GDPR compliant
- [x] Terms of Service
- [x] Privacy Policy
- [x] Cookie consent
- [x] DMCA policy

---

**🏆 Version complète = Produit compétitif prêt pour des milliers de joueurs !**
