# MISSION CODEX : Polish Final MVP - Design System & UX

## 🎯 Objectif

Finaliser le polish du MVP XNova Reforged pour une expérience utilisateur professionnelle et cohérente :
- **Design system cohérent** avec tokens de couleurs et composants standardisés
- **Animations fluides** avec Framer Motion
- **Guide joueur** complet avec règles du jeu
- **Comments dans le code critique** pour maintenabilité

## 📦 Contexte Technique

**Stack Frontend :**
- Next.js 15 (App Router)
- React 19
- TailwindCSS (thème space/sci-fi)
- Framer Motion (animations déjà installé)
- Sonner (toasts)
- next-intl (i18n FR/EN/ES/DE/IT)

**Thème actuel :**
- Couleurs principales : slate-950 (bg), blue/cyan (accents), amber (ressources)
- Typographie : système sans-serif
- Style : Space/Sci-Fi avec effets de glow et gradients

## ✅ Tâches à Réaliser

---

### 1. Design System & Tokens de Design

**1.1 Créer le fichier de tokens** `lib/design-tokens.ts`

```typescript
/**
 * Design Tokens - XNova Reforged
 * Système de design centralisé pour cohérence visuelle
 */

export const designTokens = {
  // Palette de couleurs
  colors: {
    // Backgrounds
    background: {
      primary: 'rgb(2, 6, 23)',      // slate-950
      secondary: 'rgb(15, 23, 42)',  // slate-900
      tertiary: 'rgb(30, 41, 59)',   // slate-800
    },

    // Accents
    accent: {
      primary: 'rgb(59, 130, 246)',   // blue-500
      secondary: 'rgb(14, 165, 233)', // sky-500
      tertiary: 'rgb(6, 182, 212)',   // cyan-500
    },

    // Ressources
    resources: {
      metal: 'rgb(161, 161, 170)',    // zinc-400
      crystal: 'rgb(96, 165, 250)',   // blue-400
      deuterium: 'rgb(34, 197, 94)',  // green-500
      energy: 'rgb(250, 204, 21)',    // yellow-400
      darkMatter: 'rgb(192, 132, 252)', // purple-400
    },

    // États
    status: {
      success: 'rgb(34, 197, 94)',   // green-500
      warning: 'rgb(251, 146, 60)',  // orange-400
      error: 'rgb(239, 68, 68)',     // red-500
      info: 'rgb(59, 130, 246)',     // blue-500
    },

    // Texte
    text: {
      primary: 'rgb(248, 250, 252)',   // slate-50
      secondary: 'rgb(203, 213, 225)', // slate-300
      muted: 'rgb(148, 163, 184)',     // slate-400
    },
  },

  // Espacements
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },

  // Rayons de bordure
  radius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },

  // Ombres
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    glow: '0 0 20px rgba(59, 130, 246, 0.5)',
    glowStrong: '0 0 30px rgba(59, 130, 246, 0.8)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    base: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },

  // Animations
  animations: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.2 },
    },
    slideUp: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
      transition: { duration: 0.3 },
    },
    scaleIn: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
      transition: { duration: 0.2 },
    },
    shimmer: {
      animate: {
        backgroundPosition: ['200% 0', '-200% 0'],
      },
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  },
} as const;

export type DesignTokens = typeof designTokens;
```

**1.2 Créer les classes utilitaires** `lib/design-system.ts`

```typescript
import { designTokens } from './design-tokens';

/**
 * Classes CSS réutilisables basées sur les design tokens
 */
export const designClasses = {
  // Cartes
  card: {
    base: 'rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm',
    hover: 'transition-all duration-200 hover:border-slate-600 hover:shadow-lg',
    interactive: 'cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-glow',
  },

  // Boutons
  button: {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-md transition-colors',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold px-4 py-2 rounded-md transition-colors',
    danger: 'bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-md transition-colors',
    ghost: 'hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-md transition-colors',
  },

  // Badges
  badge: {
    success: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30',
    error: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30',
  },

  // Ressources
  resource: {
    metal: 'text-zinc-400 font-mono',
    crystal: 'text-blue-400 font-mono',
    deuterium: 'text-green-400 font-mono',
    energy: 'text-yellow-400 font-mono',
    darkMatter: 'text-purple-400 font-mono',
  },

  // Titres
  heading: {
    h1: 'text-4xl font-bold text-slate-50',
    h2: 'text-3xl font-bold text-slate-50',
    h3: 'text-2xl font-semibold text-slate-100',
    h4: 'text-xl font-semibold text-slate-100',
  },

  // Texte
  text: {
    primary: 'text-slate-50',
    secondary: 'text-slate-300',
    muted: 'text-slate-400',
  },
} as const;
```

**1.3 Documenter le Design System** `docs/DESIGN_SYSTEM.md`

```markdown
# Design System - XNova Reforged

## 🎨 Philosophie

Le design de XNova Reforged s'inspire de l'espace et de la science-fiction :
- **Couleurs sombres** (slate-950) évoquant le vide spatial
- **Accents bleus/cyan** rappelant les étoiles et la technologie
- **Effets de glow** pour un aspect futuriste
- **Typographie mono** pour les ressources (style terminal)

## 🌈 Palette de Couleurs

### Backgrounds
- **Primary**: `slate-950` - Fond principal
- **Secondary**: `slate-900` - Cartes et sections
- **Tertiary**: `slate-800` - Éléments interactifs

### Accents
- **Primary**: `blue-500` - Actions principales
- **Secondary**: `sky-500` - Actions secondaires
- **Tertiary**: `cyan-500` - Highlights

### Ressources
- **Métal**: `zinc-400` - Gris métallique
- **Cristal**: `blue-400` - Bleu cristallin
- **Deutérium**: `green-500` - Vert énergie
- **Énergie**: `yellow-400` - Jaune lumineux
- **Matière Noire**: `purple-400` - Violet mystique

### États
- **Success**: `green-500`
- **Warning**: `orange-400`
- **Error**: `red-500`
- **Info**: `blue-500`

## 📏 Espacements

Utiliser les tokens de `lib/design-tokens.ts` :
- **xs**: 4px - Espaces internes très serrés
- **sm**: 8px - Espaces internes
- **md**: 16px - Espacement standard
- **lg**: 24px - Sections
- **xl**: 32px - Grandes sections
- **2xl**: 48px - Séparations majeures

## 🎭 Composants Réutilisables

### Cartes
```tsx
import { designClasses } from '@/lib/design-system';

<div className={`${designClasses.card.base} ${designClasses.card.hover}`}>
  {/* Contenu */}
</div>
```

### Boutons
```tsx
<button className={designClasses.button.primary}>
  Action Principale
</button>
```

### Badges
```tsx
<span className={designClasses.badge.success}>
  Complété
</span>
```

## ✨ Animations

Toutes les animations utilisent Framer Motion avec les variants de `design-tokens.ts`.

### Exemple
```tsx
import { motion } from 'framer-motion';
import { designTokens } from '@/lib/design-tokens';

<motion.div {...designTokens.animations.fadeIn}>
  {/* Contenu */}
</motion.div>
```

## 📱 Responsive

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md, lg)
- **Desktop**: > 1024px (xl, 2xl)

## ♿ Accessibilité

- Contraste minimum WCAG AA
- Focus visible sur tous les éléments interactifs
- ARIA labels sur icônes et boutons
- Support clavier complet
```

---

### 2. Animations Fluides avec Framer Motion

**2.1 Animer les Pages de Jeu**

Ajouter des animations d'entrée sur toutes les pages `*-client.tsx` :

```tsx
import { motion } from 'framer-motion';
import { designTokens } from '@/lib/design-tokens';

export default function BuildingsClient() {
  return (
    <motion.div
      {...designTokens.animations.fadeIn}
      className="space-y-6"
    >
      {/* Contenu existant */}
    </motion.div>
  );
}
```

**Pages à animer :**
- `overview-client.tsx`
- `buildings-client.tsx`
- `research-client.tsx`
- `fleet-client.tsx`
- `galaxy-client.tsx`
- `shipyard-client.tsx`
- Toutes les autres pages du groupe `(game)`

**2.2 Animer les Cartes (BuildingCard, etc.)**

Ajouter des animations au hover et à l'apparition :

```tsx
import { motion } from 'framer-motion';
import { designTokens } from '@/lib/design-tokens';

export const BuildingCard = memo(function BuildingCard({ ... }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="..."
    >
      {/* Contenu existant */}
    </motion.div>
  );
});
```

**Composants à animer :**
- `BuildingCard.tsx`
- `TechnologyCard.tsx` (s'il existe)
- `ShipCard.tsx` (s'il existe)
- `CombatReportCard.tsx`
- `PlanetCard.tsx` (s'il existe)

**2.3 Animer les Listes**

Utiliser `stagger` pour animer les listes d'items :

```tsx
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

<motion.div variants={container} initial="hidden" animate="show">
  {buildings.map((building) => (
    <motion.div key={building.id} variants={item}>
      <BuildingCard building={building} />
    </motion.div>
  ))}
</motion.div>
```

**2.4 Animer les Transitions de Page**

Créer `components/page-transition.tsx` :

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

Puis l'intégrer dans `GameLayout.tsx` :

```tsx
import { PageTransition } from '../page-transition';

export function GameLayout({ children }: GameLayoutProps) {
  return (
    <div className="...">
      {/* ... */}
      <main className="...">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
```

**2.5 Animer les Ressources (Compteurs)**

Créer une animation de compteur pour `ResourceDisplay.tsx` :

```tsx
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}
```

---

### 3. Guide Joueur

**Créer `docs/GUIDE_JOUEUR.md`**

```markdown
# Guide du Joueur - XNova Reforged

## 🚀 Bienvenue dans XNova Reforged

XNova Reforged est un jeu de stratégie spatial massivement multijoueur (MMORTS) où vous développez votre empire à travers les étoiles.

## 🎯 Objectifs du Jeu

1. **Développer votre économie** en construisant des mines et des infrastructures
2. **Rechercher des technologies** pour débloquer de nouvelles possibilités
3. **Construire une flotte** pour explorer, combattre et conquérir
4. **Former des alliances** pour dominer la galaxie
5. **Devenir le joueur #1** du classement

## 📊 Ressources

### Types de Ressources

#### Métal 🔩
- **Utilisation**: Construction de bâtiments, vaisseaux, défenses
- **Production**: Mine de métal
- **Stockage**: Hangar de métal

#### Cristal 💎
- **Utilisation**: Technologies avancées, vaisseaux, recherches
- **Production**: Mine de cristal
- **Stockage**: Hangar de cristal

#### Deutérium ⚗️
- **Utilisation**: Carburant pour flottes, technologies avancées
- **Production**: Synthétiseur de deutérium
- **Stockage**: Réservoir de deutérium

#### Énergie ⚡
- **Production**: Centrale solaire, Réacteur de fusion, Satellites solaires
- **Utilisation**: Nécessaire pour faire fonctionner les mines
- **Important**: Si énergie négative, production réduite !

#### Matière Noire 🌌
- **Utilisation**: Avantages premium (non implémenté dans le MVP)
- **Obtention**: Achats (futur)

### Gestion de l'Énergie

**CRITIQUE**: Votre production de ressources dépend de votre énergie :
- ✅ **Énergie positive** : Production normale
- ⚠️ **Énergie négative** : Production réduite proportionnellement

**Exemple :**
- Production: +500 énergie
- Consommation: -700 énergie
- Bilan: -200 énergie
- **Effet**: Mines produisent à 71% (500/700)

**Solution**: Construire Centrale solaire ou Réacteur de fusion

## 🏗️ Bâtiments

### Bâtiments de Ressources

#### Mine de Métal (Niveau max: 50)
- **Coût**: Métal (base: 60), Cristal (base: 15)
- **Production**: +30 métal/h au niveau 1
- **Conseil**: Priorité #1 en début de partie

#### Mine de Cristal (Niveau max: 50)
- **Coût**: Métal (base: 48), Cristal (base: 24)
- **Production**: +20 cristal/h au niveau 1
- **Conseil**: Priorité #2, développer après Mine de Métal niveau 5

#### Synthétiseur de Deutérium (Niveau max: 50)
- **Coût**: Métal (base: 225), Cristal (base: 75)
- **Production**: +10 deutérium/h au niveau 1
- **Conseil**: Développer au niveau 5+ quand flotte se développe

#### Centrale Électrique Solaire (Niveau max: 50)
- **Coût**: Métal (base: 75), Cristal (base: 30)
- **Production**: +20 énergie au niveau 1
- **Conseil**: Maintenir énergie positive en permanence

#### Réacteur de Fusion (Niveau max: 50)
- **Prérequis**: Technologie Énergie niveau 3, Synthétiseur niveau 5
- **Coût**: Métal (900), Cristal (360), Deutérium (180)
- **Production**: +30 énergie/niveau (+ bonus technologie)
- **Conseil**: Meilleure source d'énergie mid/late game

### Bâtiments de Stockage

#### Hangar de Métal / Cristal (Niveau max: 50)
- **Capacité**: 10 000 au niveau 1 → 2 millions au niveau 50
- **Conseil**: Améliorer quand stockage plein pendant sommeil

#### Réservoir de Deutérium (Niveau max: 50)
- **Capacité**: 10 000 au niveau 1
- **Conseil**: Idem hangars

### Bâtiments de Développement

#### Usine de Robots (Niveau max: 20)
- **Effet**: Réduit le temps de construction (−5% par niveau)
- **Conseil**: Niveau 5 minimum, puis 10, puis max

#### Hangar Spatial (Niveau max: 20)
- **Prérequis**: Usine de Robots niveau 2
- **Permet**: Construction de vaisseaux et défenses
- **Conseil**: INDISPENSABLE, construire dès que possible

#### Laboratoire de Recherche (Niveau max: 20)
- **Permet**: Recherches technologiques
- **Effet**: Réduit temps de recherche
- **Conseil**: Niveau 5 minimum rapidement

#### Usine de Nanites (Niveau max: 10)
- **Prérequis**: Usine de Robots niveau 10, Technologie Informatique niveau 10
- **Effet**: Réduit drastiquement les temps (−50% par niveau)
- **Conseil**: Late game, très coûteux mais puissant

## 🔬 Technologies

Les technologies se recherchent dans le Laboratoire et débloquent de nouvelles possibilités.

### Technologies Essentielles

#### Technologie Énergie (Niveau max: 30)
- **Effet**: +1% production Réacteur de Fusion par niveau
- **Prérequis pour**: Réacteur de Fusion (niveau 3), Boucliers, Laser

#### Technologie Informatique (Niveau max: 30)
- **Effet**: +1 file de flotte par niveau (pairs)
- **Prérequis pour**: Usine de Nanites (niveau 10)

#### Technologie Espionnage (Niveau max: 30)
- **Effet**: Qualité des rapports d'espionnage
- **Conseil**: Niveau 2 minimum, puis 4, puis 8

#### Réacteur à Combustion (Niveau max: 30)
- **Effet**: Vitesse Petit/Grand Transporteur, Chasseur Léger
- **Conseil**: Essentiel pour début de jeu

#### Réacteur à Impulsion (Niveau max: 30)
- **Prérequis**: Technologie Énergie niveau 1
- **Effet**: Vitesse Chasseur Lourd, Croiseur, etc.

#### Propulsion Hyperespace (Niveau max: 30)
- **Prérequis**: Technologie Énergie niveau 5, Bouclier niveau 5
- **Effet**: Vitesse vaisseaux avancés (Bombardier, etc.)

### Technologies de Combat

#### Technologie Militaire (Niveau max: 30)
- **Effet**: +10% attaque par niveau
- **Conseil**: Critique pour combats

#### Technologie Bouclier (Niveau max: 30)
- **Effet**: +10% bouclier par niveau

#### Technologie Blindage (Niveau max: 30)
- **Effet**: +10% coque par niveau

## 🚢 Vaisseaux

### Vaisseaux de Transport

#### Petit Transporteur
- **Capacité**: 5 000
- **Vitesse**: Rapide (Combustion)
- **Usage**: Transport early game

#### Grand Transporteur
- **Capacité**: 25 000
- **Vitesse**: Lent mais efficace
- **Usage**: Transport mid/late game

#### Recycleur
- **Capacité**: 20 000
- **Usage**: Récupérer les débris après combats
- **Conseil**: 1-2 minimum

### Vaisseaux de Combat

#### Chasseur Léger
- **Coût**: Faible
- **Puissance**: Faible
- **Usage**: Début de jeu, cannon fodder

#### Chasseur Lourd
- **Coût**: Moyen
- **Puissance**: Moyenne
- **Usage**: Mid game, polyvalent

#### Croiseur
- **Coût**: Élevé
- **Puissance**: Élevée
- **Rapid Fire**: vs Chasseur Léger (×3), Lanceur (×10)

#### Vaisseau de Bataille
- **Coût**: Très élevé
- **Puissance**: Très élevée
- **Usage**: Late game, combats majeurs

#### Bombardier
- **Spécialité**: Anti-défenses
- **Rapid Fire**: vs toutes les défenses

### Vaisseaux Spéciaux

#### Sonde d'Espionnage
- **Usage**: Scanner les planètes ennemies
- **Conseil**: Toujours en avoir 10+

#### Vaisseau de Colonisation
- **Usage**: Fonder de nouvelles colonies
- **Important**: Détruit après colonisation !

#### Satellite Solaire
- **Production**: +25 énergie
- **Usage**: Alternative aux Centrales
- **Conseil**: 50-100 mid game

## ⚔️ Combat

### Mécanique de Combat

1. **Tours**: Maximum 6 tours
2. **Rapid Fire**: Certains vaisseaux tirent plusieurs fois
3. **Explosion**: 70% de chance si coque < 30%
4. **Débris**: 30% des coûts détruits → débris spatial

### Calcul des Dégâts

```
Dégâts = Puissance Arme × (1 - Bouclier Ennemi / 100)
Si Dégâts > 1% Coque: Coque réduite
```

### Pillage

- Vous pouvez piller **50% max** des ressources ennemies
- Limité par **capacité de cargo** de votre flotte

### Débris

- **30%** du Métal/Cristal des vaisseaux détruits
- Récupérable avec Recycleurs

### Conseils Combat

1. **Espionner** avant d'attaquer (Sondes)
2. **Calculer** capacité cargo nécessaire
3. **Rapid Fire**: Privilégier vaisseaux avec bonus
4. **Timing**: Attaquer quand joueur offline
5. **Retour**: Flottes reviennent automatiquement

## 🌌 Galaxie

### Structure
- **5 galaxies** × **499 systèmes** × **15 positions**
- Coordonnées: `[G:S:P]` (ex: 1:123:7)

### Types de Positions

- **Planète joueur**: Peut attaquer, espionner, transporter
- **Planète inactive**: Joueur absent >7j, facile à piller
- **Position vide**: Peut coloniser (si Vaisseau Colonisation)

### Colonisation

1. **Construire** Vaisseau de Colonisation
2. **Rechercher** Technologie Astrophysique (1 colonie par niveau)
3. **Envoyer** mission "Coloniser" sur position vide
4. **Important**: Vaisseau détruit, nouvelle planète créée

### Distance

Le temps de vol dépend de la distance :
- Même système: Rapide
- Systèmes proches: Moyen
- Autre galaxie: Très long

## 👥 Alliances

### Créer/Rejoindre

- **Créer**: Coûte des ressources
- **Rejoindre**: Sur invitation ou candidature
- **Tag**: 3-8 caractères devant le nom

### Avantages

1. **Protection**: Membres ne peuvent pas s'attaquer
2. **Coordination**: Chat, diplomatie
3. **Partage**: Système de ravitaillement (via Dépôt)
4. **Classement**: Points d'alliance cumulés

## 📈 Statistiques

### Types de Points

- **Économie**: Bâtiments + Défenses
- **Recherche**: Technologies
- **Militaire**: Vaisseaux construits
- **Militaire Détruit**: Vaisseaux ennemis détruits
- **Militaire Perdu**: Vos vaisseaux détruits

### Classement

- Top 100 joueurs
- Top 50 alliances
- Mise à jour toutes les heures

## 💡 Stratégies

### Début de Jeu (Jours 1-3)

1. **Jour 1**:
   - Mine Métal → 5
   - Mine Cristal → 3
   - Centrale Solaire → 3
   - Synthétiseur → 2

2. **Jour 2**:
   - Usine Robots → 2
   - Hangar Spatial → 1
   - Laboratoire → 1
   - Commencer recherches (Énergie, Combustion)

3. **Jour 3**:
   - Mine Métal → 10
   - Construire Petits Transporteurs (5-10)
   - Construire Sondes (10)
   - Chercher Espionnage niveau 2

### Mid Game (Semaines 1-2)

- **Économie**: Mines niveau 15-20
- **Recherche**: Impulsion, Bouclier, Militaire
- **Flotte**: Chasseurs Lourds, Croiseurs
- **Expansion**: 2-3 planètes
- **Alliance**: Rejoindre une alliance active

### Late Game (Semaines 3+)

- **Domination**: Combats réguliers
- **Technologies**: Niveau 20+
- **Flotte**: Vaisseaux de Bataille, Bombardiers
- **Colonies**: 5+ planètes optimisées
- **Alliance**: Guerre et diplomatie

## ⚙️ Astuces Pro

1. **Production nocturne**: Ajuster stockage pour ne pas gaspiller
2. **Fleet Save**: Envoyer flotte en mission longue avant sommeil
3. **Spy-Crash**: Espionner avec 1 sonde (sacrifiable)
4. **Débris farming**: Coordonner combats alliés pour recyclage
5. **Timing recherche**: Lancer recherches longues avant sommeil
6. **Files de construction**: Planifier à l'avance (24h+)

## 🆘 Aide

- **Wiki**: https://xnova.wiki (fictif)
- **Discord**: https://discord.gg/xnova (fictif)
- **Forum**: https://forum.xnova.com (fictif)

---

**Bonne chance, Commandant ! L'univers vous attend. 🚀**
```

**Traduire le guide dans toutes les langues** :
- Créer `docs/PLAYER_GUIDE_EN.md`
- Créer `docs/PLAYER_GUIDE_ES.md`
- Créer `docs/PLAYER_GUIDE_DE.md`
- Créer `docs/PLAYER_GUIDE_IT.md`

(Utiliser next-intl ou traduction manuelle/IA)

---

### 4. Comments dans le Code Critique

**Ajouter des comments JSDoc sur les fonctions critiques :**

#### Fichiers à commenter

**Services Backend (`apps/api/src/`) :**

1. **`resources/resources.service.ts`**
```typescript
/**
 * Calcule la production horaire des ressources pour une planète
 *
 * Formule legacy OGame:
 * Production = BaseProd × (1 + MineLevel) × MineLevel × 0.5 × EnergyFactor × GameSpeed
 *
 * @param planet - Planète avec niveaux de bâtiments
 * @param energyBalance - Bilan énergétique (production - consommation)
 * @param gameSpeed - Multiplicateur serveur (ex: 2500)
 * @returns Production par ressource (metal, crystal, deuterium)
 *
 * @example
 * calculateProduction(planet, 50, 2500)
 * // => { metal: 1500, crystal: 800, deuterium: 300 }
 */
calculateProduction(planet, energyBalance, gameSpeed) { ... }
```

2. **`combat/combat-engine.service.ts`**
```typescript
/**
 * Simule un combat entre attaquant et défenseur
 *
 * Algorithme:
 * 1. Pour chaque tour (max 6):
 *    - Calcul rapid fire (tirs multiples)
 *    - Application dégâts sur boucliers puis coque
 *    - Explosion si coque < 30% (70% chance)
 * 2. Génération débris (30% coûts détruits)
 * 3. Calcul pillage (50% max, limité par cargo)
 *
 * @param attackerShips - Composition flotte attaquante
 * @param defenderShips - Composition flotte défensive + défenses
 * @param attackerTech - Technologies de l'attaquant
 * @param defenderTech - Technologies du défenseur
 * @returns Rapport de combat complet
 */
simulateCombat(...) { ... }
```

3. **`buildings/buildings.service.ts`**
```typescript
/**
 * Calcule le coût d'amélioration d'un bâtiment
 *
 * Formule exponentielle:
 * Cost = BaseCost × (Factor ^ CurrentLevel)
 *
 * Factor varie selon le bâtiment:
 * - Mines: 1.5
 * - Stockage: 2.0
 * - Stratégiques: 1.8
 *
 * @param buildingId - ID du bâtiment (1-14)
 * @param currentLevel - Niveau actuel
 * @returns { metal, crystal, deuterium, time }
 */
calculateUpgradeCost(buildingId, currentLevel) { ... }
```

**Composants Frontend (`apps/web/components/`) :**

1. **`game/layout/GameLayout.tsx`**
```tsx
/**
 * Layout principal du jeu avec fond spatial animé
 *
 * Features:
 * - Background avec gradients radiaux (étoiles)
 * - Particles CSS (simulation étoiles lointaines)
 * - Sidebar responsive (mobile menu)
 * - Header avec sélection planète
 * - Lazy-load des notifications combat
 *
 * @param children - Pages du jeu (overview, buildings, etc.)
 */
export function GameLayout({ children }: GameLayoutProps) { ... }
```

2. **`hooks/use-toast-mutations.ts`**
```typescript
/**
 * Hook React Query avec intégration toasts automatiques
 *
 * Workflow:
 * 1. onMutate: Affiche toast "loading"
 * 2. onSuccess: Remplace par toast "success"
 * 3. onError: Remplace par toast "error"
 *
 * @template TData - Type de données retournées
 * @template TError - Type d'erreur
 * @template TVariables - Type de variables mutation
 *
 * @example
 * const upgradeMutation = useToastMutation({
 *   mutationFn: (id) => api.post(`/buildings/${id}`),
 *   successMessage: 'Bâtiment amélioré',
 *   errorMessage: 'Erreur lors de l\'amélioration',
 * });
 */
export function useToastMutation<...>(...) { ... }
```

**Fichiers de config (`packages/game-config/src/`) :**

1. **`buildings.ts`**
```typescript
/**
 * Configuration statique des 14 types de bâtiments
 *
 * Source: Legacy XNova 0.8 (2008) avec équilibrage 2026
 *
 * Modifications vs original:
 * - Factor 2.0 → 1.8 pour bâtiments stratégiques
 * - Energy consumption rééquilibré
 * - Multiplicateurs configurables (admin panel)
 *
 * @see docs/GAME_BALANCE.md pour détails équilibrage
 */
export const buildings: Record<number, BuildingConfig> = { ... }
```

---

### 5. Petits Ajustements UX

**5.1 Améliorer les Focus States**

Ajouter dans `globals.css` :
```css
/* Focus visible pour accessibilité */
*:focus-visible {
  @apply outline-2 outline-offset-2 outline-blue-500;
}

/* Smooth scroll */
html {
  scroll-behavior: smooth;
}

/* Selection color */
::selection {
  @apply bg-blue-500/30 text-slate-50;
}
```

**5.2 Améliorer les Loading States**

Dans tous les skeletons, ajouter l'animation shimmer :

```tsx
// components/ui/skeleton.tsx
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200 dark:bg-slate-800",
        "relative overflow-hidden",
        "before:absolute before:inset-0",
        "before:-translate-x-full",
        "before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-slate-700/10 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}
```

Ajouter dans `tailwind.config.ts` :
```js
theme: {
  extend: {
    keyframes: {
      shimmer: {
        '100%': { transform: 'translateX(100%)' },
      },
    },
  },
}
```

**5.3 Améliorer les Tooltips**

Si non présent, créer `components/ui/tooltip.tsx` avec Radix UI ou solution simple :

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-sm bg-slate-800 text-slate-100 rounded-md shadow-lg whitespace-nowrap z-50"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## 📁 Fichiers à Créer/Modifier

### Fichiers à créer

**Design System :**
1. `lib/design-tokens.ts`
2. `lib/design-system.ts`
3. `docs/DESIGN_SYSTEM.md`

**Guide Joueur :**
4. `docs/GUIDE_JOUEUR.md` (FR)
5. `docs/PLAYER_GUIDE_EN.md`
6. `docs/PLAYER_GUIDE_ES.md`
7. `docs/PLAYER_GUIDE_DE.md`
8. `docs/PLAYER_GUIDE_IT.md`

**Composants UX :**
9. `components/page-transition.tsx`
10. `components/ui/tooltip.tsx` (si non existant)

### Fichiers à modifier

**Animations (≈20 fichiers) :**
- Tous les `*-client.tsx` des pages de jeu
- `BuildingCard.tsx`, `CombatReportCard.tsx`, etc.
- `GameLayout.tsx` (intégrer PageTransition)
- `ResourceDisplay.tsx` (AnimatedNumber)
- Tous les skeletons (shimmer effect)

**CSS :**
- `app/globals.css` (focus, selection, smooth scroll)
- `tailwind.config.ts` (keyframes shimmer)

**Comments :**
- `apps/api/src/resources/resources.service.ts`
- `apps/api/src/combat/combat-engine.service.ts`
- `apps/api/src/buildings/buildings.service.ts`
- `apps/web/components/game/layout/GameLayout.tsx`
- `apps/web/hooks/use-toast-mutations.ts`
- `packages/game-config/src/buildings.ts`
- Et autres fichiers critiques à ton jugement

---

## 🚫 Contraintes

- **NE PAS** casser les fonctionnalités existantes
- **NE PAS** modifier la logique métier (calculs, formules)
- **PRÉSERVER** toutes les traductions i18n existantes
- **TESTER** chaque animation (pas de lag)
- **ACCESSIBILITÉ** : Animations respect `prefers-reduced-motion`

```tsx
// Respecter les préférences utilisateur
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  animate={prefersReducedMotion ? {} : { ... }}
>
```

---

## 📊 Critères de Succès

### Obligatoires
- ✅ Design tokens créés et documentés
- ✅ Minimum 15 composants animés
- ✅ Guide joueur complet (FR + EN minimum)
- ✅ 10+ fonctions critiques commentées (JSDoc)
- ✅ Build réussit sans erreurs
- ✅ Aucune régression fonctionnelle

### Bonus
- Animations respectent `prefers-reduced-motion`
- Tooltips sur toutes les icônes
- Guide traduit dans les 5 langues
- 20+ fonctions commentées
- Storybook ou composants documentés

---

## 📝 Rapport Final Attendu

```markdown
# Rapport CODEX - Polish Final MVP

## ✅ Tâches Complétées

### 1. Design System
- [x] Tokens créés (lib/design-tokens.ts)
- [x] Classes utilitaires (lib/design-system.ts)
- [x] Documentation (docs/DESIGN_SYSTEM.md)

### 2. Animations
- [x] XX pages animées
- [x] XX composants avec hover effects
- [x] XX listes avec stagger
- [x] Transitions de page (PageTransition)
- [x] Compteurs animés (ResourceDisplay)

### 3. Guide Joueur
- [x] Guide FR complet (XX pages)
- [x] Guide EN
- [x] Guide ES/DE/IT (optionnel)

### 4. Comments Code
- [x] XX fonctions commentées (JSDoc)
- [x] Services backend
- [x] Hooks frontend
- [x] Configs game

### 5. UX Polish
- [x] Focus states améliorés
- [x] Shimmer loading
- [x] Tooltips (optionnel)

## 📁 Fichiers Créés
1. [liste]

## 📁 Fichiers Modifiés
1. [liste]

## ⚠️ Problèmes Rencontrés
[si applicable]

## 💡 Recommandations
[améliorations futures]
```

---

**Bonne chance, agent CODEX ! Rendez XNova Reforged magnifique ! ✨🚀**
