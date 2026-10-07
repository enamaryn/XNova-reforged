import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBootstrapServer } from '../server.mjs';
import { readConfiguration } from '../config.mjs';

test('navigateur : première page, formulaire local, progression et continuation SMTP', {
  skip: !process.env.XNOVA_INSTALL_CHROMIUM && 'Définir XNOVA_INSTALL_CHROMIUM pour le test navigateur',
}, async t => {
  const { chromium } = await import('@playwright/test');
  const root = mkdtempSync(join(tmpdir(), 'xnova-install-browser-'));
  const code = 'b'.repeat(64);
  let handoff = false;
  const app = createBootstrapServer({ root, accessCode: code, install: async (_config, _code, report) => {
    report('Création de la base locale');
    return { setupRequired: true };
  }, handoff: async () => { handoff = true; } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.XNOVA_INSTALL_CHROMIUM, args: ['--no-sandbox'] });
  t.after(async () => {
    await browser.close();
    await app.settled();
    await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
    rmSync(root, { recursive: true, force: true });
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.getByLabel('Code d’accès temporaire').fill(code);
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await page.getByLabel('Utilisation').selectOption('development');
  assert.equal(await page.getByLabel('Adresse publique du site').inputValue(), 'http://127.0.0.1');
  assert.equal(await page.getByLabel('Comment le site sera-t-il accessible ?').inputValue(), 'none');
  await page.getByRole('button', { name: 'Préparer le serveur' }).click();
  const next = page.getByRole('button', { name: 'Continuer : SMTP et compte administrateur' });
  await next.waitFor({ state: 'visible' });
  const config = readConfiguration(root);
  assert.equal(config.state.database, 'local');
  assert.equal(config.env.NEXT_PUBLIC_API_URL, '/api');
  assert.ok(!(await page.locator('body').innerText()).includes(config.env.JWT_SECRET));
  await page.route('http://127.0.0.1/setup', route => route.fulfill({ contentType: 'text/html', body: '<h1>Configuration SMTP</h1>' }));
  await next.click();
  await page.getByRole('heading', { name: 'Configuration SMTP' }).waitFor();
  assert.equal(handoff, true);
  assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('bootstrap-token'), code);
  assert.deepEqual(errors, []);
});
