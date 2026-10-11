#!/usr/bin/env node
// Copie docs/FAQ*.md vers apps/web/content/faq/<langue>.md (contenu servi par les pages /faq et /help).
// Usage : node scripts/faq/sync-faq.mjs [--check]   (--check : échoue si les copies diffèrent, sans écrire)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FAQ_FILES = { fr: 'FAQ.md', en: 'FAQ_EN.md', es: 'FAQ_ES.md', de: 'FAQ_DE.md', it: 'FAQ_IT.md' };
const check = process.argv.includes('--check');
const outDir = join(root, 'apps', 'web', 'content', 'faq');

let drift = 0;
for (const [locale, file] of Object.entries(FAQ_FILES)) {
  const source = join(root, 'docs', file);
  if (!existsSync(source)) {
    // Construction hors dépôt complet : on garde les copies déjà présentes
    console.warn(`FAQ : ${file} introuvable, copie conservée`);
    continue;
  }
  const target = join(outDir, `${locale}.md`);
  const content = readFileSync(source, 'utf8');
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current === content) continue;
  if (check) {
    console.error(`FAQ : ${locale}.md n'est pas synchronisé avec docs/${file} (lancer node scripts/faq/sync-faq.mjs)`);
    drift += 1;
  } else {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(target, content);
    console.log(`FAQ : ${locale}.md mis à jour`);
  }
}
process.exit(drift ? 1 : 0);
