# Design System - XNova Reforged

## Philosophie

Le design de XNova Reforged s'inspire de l'espace et de la science-fiction :
- **Couleurs sombres** (slate-950) evoquant le vide spatial
- **Accents bleus/cyan** rappelant les etoiles et la technologie
- **Effets de glow** pour un aspect futuriste
- **Typographie mono** pour les ressources (style terminal)

## Palette de Couleurs

### Backgrounds
- **Primary**: `slate-950` - Fond principal
- **Secondary**: `slate-900` - Cartes et sections
- **Tertiary**: `slate-800` - Elements interactifs

### Accents
- **Primary**: `blue-500` - Actions principales
- **Secondary**: `sky-500` - Actions secondaires
- **Tertiary**: `cyan-500` - Highlights

### Ressources
- **Metal**: `zinc-400` - Gris metallique
- **Cristal**: `blue-400` - Bleu cristallin
- **Deuterium**: `green-500` - Vert energie
- **Energie**: `yellow-400` - Jaune lumineux
- **Matiere Noire**: `purple-400` - Violet mystique

### Etats
- **Success**: `green-500`
- **Warning**: `orange-400`
- **Error**: `red-500`
- **Info**: `blue-500`

## Espacements

Utiliser les tokens de `apps/web/lib/design-tokens.ts` :
- **xs**: 4px - Espaces internes tres serres
- **sm**: 8px - Espaces internes
- **md**: 16px - Espacement standard
- **lg**: 24px - Sections
- **xl**: 32px - Grandes sections
- **2xl**: 48px - Separations majeures

## Composants Reutilisables

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
  Complete
</span>
```

## Animations

Toutes les animations utilisent Framer Motion avec les variants de `apps/web/lib/design-tokens.ts`.

### Exemple
```tsx
import { motion } from 'framer-motion';
import { designTokens } from '@/lib/design-tokens';

<motion.div {...designTokens.animations.fadeIn}>
  {/* Contenu */}
</motion.div>
```

## Responsive

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md, lg)
- **Desktop**: > 1024px (xl, 2xl)

## Accessibilite

- Contraste minimum WCAG AA
- Focus visible sur tous les elements interactifs
- ARIA labels sur icones et boutons
- Support clavier complet
