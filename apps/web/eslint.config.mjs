import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** Configuration ESLint 9 (flat config) du site web : règles de Next (core-web-vitals + TypeScript) et nos réglages. */
const config = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**', 'content/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Règles « React Compiler » ajoutées par eslint-plugin-react-hooks 7 : le projet n'utilise pas le compilateur
      // et ces motifs (horloge en état, détection client par effet) sont voulus. Visibles en avertissement.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      // Navigations complètes volontaires (connexion/déconnexion) : elles vident le cache du routeur.
      '@next/next/no-location-assign-relative-destination': 'off',
    },
  },
];

export default config;
