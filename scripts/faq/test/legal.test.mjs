import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'web', 'content', 'legal');
const locales = ['fr', 'en', 'es', 'de', 'it'];
const documents = ['terms', 'privacy'];
const read = (doc, locale) => readFileSync(join(dir, `${doc}.${locale}.md`), 'utf8');

for (const doc of documents) {
  test(`${doc} : les cinq langues ont les mêmes sections, tableaux et marqueurs`, () => {
    const shape = (text) => ({
      h1: (text.match(/^# /gm) ?? []).length,
      h2: (text.match(/^## /gm) ?? []).length,
      tableRows: (text.match(/^\|/gm) ?? []).length,
      operator: (text.match(/\{\{OPERATOR\}\}/g) ?? []).length,
      contact: (text.match(/\{\{CONTACT\}\}/g) ?? []).length,
      locale: (text.match(/\{\{LOCALE\}\}/g) ?? []).length,
    });
    const reference = shape(read(doc, 'fr'));
    for (const locale of locales) assert.deepEqual(shape(read(doc, locale)), reference, `${doc}.${locale}.md`);
    assert.equal(reference.h1, 1);
    assert.ok(reference.operator >= 1 && reference.contact >= 1);
  });
}

test('la politique de confidentialité cite les données réellement collectées', () => {
  for (const locale of locales) {
    const text = read('privacy', locale);
    for (const token of ['Argon2', 'xnova_access', 'NEXT_LOCALE', 'Sentry', '/64', '90', '30']) assert.ok(text.includes(token), `${locale} : ${token}`);
  }
});

test('les liens internes pointent vers l’autre document, dans la même langue', () => {
  for (const locale of locales) {
    assert.ok(read('terms', locale).includes('(/{{LOCALE}}/privacy)'));
    assert.ok(read('privacy', locale).includes('(/{{LOCALE}}/terms)'));
  }
});
