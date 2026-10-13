#!/usr/bin/env node
// Couverture de l'API : tests unitaires + tests d'intégration (PostgreSQL requis, DATABASE_URL), fusionnés.
// Les services de jeu sont testés par l'intégration : la couverture unitaire seule (≈ 16 %) n'a aucun sens.
// Usage : DATABASE_URL=… node scripts/coverage/api-coverage.mjs [--merge-only]
// Seuils (marge sous la mesure du 12 octobre 2026 : lignes 90 %, instructions 89 %, branches 78 %, fonctions 89 %).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const api = join(root, 'apps/api');
const require = createRequire(join(api, 'package.json'));
const THRESHOLDS = { statements: 85, lines: 85, branches: 70, functions: 80 };
const dirs = { unit: '/tmp/xnova-cov-unit', integration: '/tmp/xnova-cov-int' };
const SOURCES = ['--collectCoverageFrom=src/**/*.ts', '--collectCoverageFrom=!src/**/*.module.ts', '--collectCoverageFrom=!src/main.ts', '--collectCoverageFrom=!src/**/dto/**'];

function jest(args) {
  const result = spawnSync('npx', ['jest', ...args, '--coverage', ...SOURCES, '--coverageReporters=json'], { cwd: api, stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes('--merge-only')) {
  jest(['--coverageDirectory', dirs.unit]);
  // Les suites d'intégration partagent la même base et l'état global setup.completedAt : jamais en parallèle
  jest(['--config', 'jest.integration.config.cjs', '--runInBand', '--coverageDirectory', dirs.integration]);
}

const libCoverage = require('istanbul-lib-coverage');
const map = libCoverage.createCoverageMap({});
for (const dir of Object.values(dirs)) map.merge(JSON.parse(readFileSync(join(dir, 'coverage-final.json'), 'utf8')));
const summary = map.getCoverageSummary().toJSON();
let failed = false;
console.log('\nCouverture API (unitaires + intégration) :');
for (const [key, minimum] of Object.entries(THRESHOLDS)) {
  const { pct, covered, total } = summary[key];
  const ok = pct >= minimum;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'OK ' : 'KO '} ${key.padEnd(11)} ${String(pct).padStart(6)} % (${covered}/${total}) — seuil ${minimum} %`);
}
process.exit(failed ? 1 : 0);
