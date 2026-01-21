import { designTokens } from './design-tokens';

/**
 * Classes CSS reutilisables basees sur les design tokens
 */
export const designClasses = {
  // Cartes
  card: {
    base: 'rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm',
    hover: 'transition-all duration-200 hover:border-slate-600 hover:shadow-lg',
    interactive:
      'cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-glow',
  },

  // Boutons
  button: {
    primary:
      'bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-md transition-colors',
    secondary:
      'bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold px-4 py-2 rounded-md transition-colors',
    danger:
      'bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-md transition-colors',
    ghost: 'hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-md transition-colors',
  },

  // Badges
  badge: {
    success:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30',
    warning:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30',
    error:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    info:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30',
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

export { designTokens };
