#!/usr/bin/env node
// Mesure Lighthouse (mobile et bureau) des pages publiques d'un site déjà démarré.
// Usage : node scripts/perf/lighthouse.mjs [http://127.0.0.1:3000] [passages=3]
// Prérequis : `npx lighthouse` disponible (téléchargé par npx) et Chromium (CHROME_PATH ou PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH).
// Affiche la médiane des passages ; la première mesure à froid est souvent pessimiste.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const runs = Math.max(1, Number(process.argv[3] ?? 3));
const chrome = process.env.CHROME_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const pages = ['/fr', '/fr/login', '/fr/register'];
const dir = mkdtempSync(join(tmpdir(), 'xnova-lh-'));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const result = {};
for (const path of pages) {
  for (const form of ['mobile', 'desktop']) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const out = join(dir, `${form}-${i}.json`);
      execFileSync(
        'npx',
        ['--yes', 'lighthouse', `${base}${path}`, '--output=json', `--output-path=${out}`, '--quiet',
          '--only-categories=performance,accessibility,best-practices,seo',
          ...(form === 'desktop' ? ['--preset=desktop'] : []),
          '--chrome-flags=--headless=new --no-sandbox --disable-gpu'],
        { stdio: 'ignore', env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) } },
      );
      const report = JSON.parse(readFileSync(out, 'utf8'));
      samples.push({
        performance: Math.round(report.categories.performance.score * 100),
        accessibility: Math.round(report.categories.accessibility.score * 100),
        'best-practices': Math.round(report.categories['best-practices'].score * 100),
        seo: Math.round(report.categories.seo.score * 100),
        lcpMs: Math.round(report.audits['largest-contentful-paint'].numericValue),
        tbtMs: Math.round(report.audits['total-blocking-time'].numericValue),
        cls: Number(report.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
      });
    }
    const pick = (key) => median(samples.map((s) => s[key]));
    result[`${path}-${form}`] = {
      scores: { performance: pick('performance'), accessibility: pick('accessibility'), 'best-practices': pick('best-practices'), seo: pick('seo') },
      lcpMs: pick('lcpMs'), tbtMs: pick('tbtMs'), cls: pick('cls'), runs,
    };
  }
}
console.log(JSON.stringify(result, null, 2));
