/**
 * Configuration ESLint commune (QUAL-01) — ESLint 8, format eslintrc.
 * Les erreurs visent les défauts probables ; les règles de style ou de dette restent en avertissement
 * pour que `npm run lint` soit exploitable (échec uniquement sur une vraie erreur).
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    'coverage/',
    'test-results/',
    'playwright-report/',
    'docs/audits/',
    '*.cjs',
    '*.js',
    '*.mjs',
    'apps/web/**', // règles propres au web : apps/web/.eslintrc.json (next lint)
  ],
  rules: {
    // Dette connue (typage souple, imports inutilisés) : visible sans bloquer
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/no-unsafe-function-type': 'warn',
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['**/test/**/*.ts', '**/*.spec.ts'],
      env: { jest: true },
    },
  ],
};
