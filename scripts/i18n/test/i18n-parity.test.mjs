// Parité des traductions : les 5 langues proposées (fr, en, es, de, it) doivent exposer exactement
// les mêmes clés, avec les mêmes marqueurs {param}, dans les deux jeux de messages du frontend
// (next-intl : pages publiques/authentification ; « game » : interface de jeu).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const LOCALES = ['fr', 'en', 'es', 'de', 'it'];
const SETS = {
  'messages (next-intl)': 'apps/web/i18n/messages',
  'game (interface de jeu)': 'apps/web/i18n/game',
};

function load(dir, locale) {
  return JSON.parse(readFileSync(path.join(root, dir, `${locale}.json`), 'utf8'));
}

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[prefix + key, value]]
      : flatten(value, `${prefix}${key}.`),
  );
}

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('la configuration annonce bien les 5 langues prévues', () => {
  const config = readFileSync(path.join(root, 'apps/web/i18n/config.ts'), 'utf8');
  for (const locale of LOCALES) assert.match(config, new RegExp(`'${locale}'`));
});

for (const [label, dir] of Object.entries(SETS)) {
  const reference = new Map(flatten(load(dir, 'fr')));

  for (const locale of LOCALES.filter((l) => l !== 'fr')) {
    test(`${label} : ${locale} a exactement les clés du français`, () => {
      const current = new Map(flatten(load(dir, locale)));
      const missing = [...reference.keys()].filter((key) => !current.has(key));
      const extra = [...current.keys()].filter((key) => !reference.has(key));
      assert.deepEqual(missing, [], `clés manquantes en ${locale}`);
      assert.deepEqual(extra, [], `clés en trop en ${locale}`);
    });

    test(`${label} : ${locale} garde les mêmes marqueurs {param} et aucune valeur vide`, () => {
      const current = new Map(flatten(load(dir, locale)));
      for (const [key, frText] of reference) {
        const text = current.get(key);
        if (text === undefined) continue; // déjà signalé par le test de clés
        assert.ok(text.trim().length > 0, `${locale}:${key} est vide`);
        assert.equal(placeholders(text), placeholders(frText), `${locale}:${key} : marqueurs différents`);
      }
    });
  }
}
