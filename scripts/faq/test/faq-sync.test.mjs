import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const files = { fr: 'FAQ.md', en: 'FAQ_EN.md', es: 'FAQ_ES.md', de: 'FAQ_DE.md', it: 'FAQ_IT.md' };

for (const [locale, file] of Object.entries(files)) {
  test(`la copie web de la FAQ ${locale} est synchronisée avec docs/${file}`, () => {
    const source = readFileSync(join(root, 'docs', file), 'utf8');
    const copy = readFileSync(join(root, 'apps', 'web', 'content', 'faq', `${locale}.md`), 'utf8');
    assert.equal(copy, source, 'lancer : node scripts/faq/sync-faq.mjs');
  });
}

test('les cinq FAQ ont la même structure de sections et le même nombre de tableaux', () => {
  const stats = Object.values(files).map((file) => {
    const text = readFileSync(join(root, 'docs', file), 'utf8');
    return {
      h2: (text.match(/^## /gm) ?? []).length,
      tables: (text.match(/^\|[-: |]+\|$/gm) ?? []).length,
    };
  });
  for (const s of stats) assert.deepEqual(s, stats[0]);
});
