/**
 * Design Tokens - XNova Reforged
 * Systeme de design centralise pour coherence visuelle
 */

export const designTokens = {
  // Palette de couleurs
  colors: {
    // Backgrounds
    background: {
      primary: 'rgb(2, 6, 23)',
      secondary: 'rgb(15, 23, 42)',
      tertiary: 'rgb(30, 41, 59)',
    },

    // Accents
    accent: {
      primary: 'rgb(59, 130, 246)',
      secondary: 'rgb(14, 165, 233)',
      tertiary: 'rgb(6, 182, 212)',
    },

    // Ressources
    resources: {
      metal: 'rgb(161, 161, 170)',
      crystal: 'rgb(96, 165, 250)',
      deuterium: 'rgb(34, 197, 94)',
      energy: 'rgb(250, 204, 21)',
      darkMatter: 'rgb(192, 132, 252)',
    },

    // Etats
    status: {
      success: 'rgb(34, 197, 94)',
      warning: 'rgb(251, 146, 60)',
      error: 'rgb(239, 68, 68)',
      info: 'rgb(59, 130, 246)',
    },

    // Texte
    text: {
      primary: 'rgb(248, 250, 252)',
      secondary: 'rgb(203, 213, 225)',
      muted: 'rgb(148, 163, 184)',
    },
  },

  // Espacements
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  // Rayons de bordure
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
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
