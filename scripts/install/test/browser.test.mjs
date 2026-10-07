import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { bootstrapListenHost } from '../network.mjs';
import { createBootstrapServer } from '../server.mjs';
import { readConfiguration } from '../config.mjs';

async function browserScenario(t, serviceAction) {
  const { chromium } = await import('@playwright/test');
  const root = mkdtempSync(join(tmpdir(), 'xnova-install-browser-'));
  const code = 'b'.repeat(64);
  let handoff = false;
  const app = createBootstrapServer({ root, accessCode: code, existingServices: () => serviceAction ? ['xnova-api.service', 'xnova-web.service'] : [], install: async (_config, _code, report) => {
    report('Création de la base locale');
    return { setupRequired: true };
  }, handoff: async () => { handoff = true; } });
  await new Promise(resolve => app.server.listen(0, bootstrapListenHost(), resolve));
  const browser = await chromium.launch({ executablePath: process.env.XNOVA_INSTALL_CHROMIUM, args: ['--no-sandbox', '--no-proxy-server'] });
  t.after(async () => {
    await browser.close();
    await app.settled();
    await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
    rmSync(root, { recursive: true, force: true });
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const address = Object.values(networkInterfaces()).flat().find(entry => !entry.internal && entry.family === 'IPv4')?.address || '127.0.0.2';
  await page.goto(`http://${address}:${app.server.address().port}`);
  await page.getByLabel('Code d’accès temporaire').fill(code);
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await page.getByLabel('Utilisation').selectOption('development');
  assert.equal(await page.getByLabel('Adresse publique du site').inputValue(), `http://${address}`);
  assert.equal(await page.getByLabel('Comment le site sera-t-il accessible ?').inputValue(), 'none');
  if (serviceAction) {
    await page.getByRole('button', { name: 'Préparer le serveur' }).click();
    assert.equal(readConfiguration(root), null, 'Le choix de traitement des services est obligatoire.');
    await page.getByRole('radio', { name: serviceAction === 'keep' ? 'Garder et reprendre' : 'Supprimer et recréer' }).check();
  } else assert.equal(await page.locator('#existing-services').isVisible(), false);
  await page.getByRole('button', { name: 'Préparer le serveur' }).click();
  const next = page.getByRole('button', { name: 'Continuer : SMTP et compte administrateur' });
  await next.waitFor({ state: 'visible' });
  const config = readConfiguration(root);
  assert.equal(config.state.database, 'local');
  assert.equal(config.state.replaceServices, serviceAction === 'keep');
  assert.equal(config.env.NEXT_PUBLIC_API_URL, '/api');
  assert.ok(!(await page.locator('body').innerText()).includes(config.env.JWT_SECRET));
  await page.route(`http://${address}/setup`, route => route.fulfill({ contentType: 'text/html', body: '<h1>Configuration SMTP</h1>' }));
  await next.click();
  await page.getByRole('heading', { name: 'Configuration SMTP' }).waitFor();
  assert.equal(handoff, true);
  assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('bootstrap-token'), code);
  assert.deepEqual(errors, []);
}

for (const action of [undefined, 'keep', 'recreate']) {
  test(`navigateur : IP réseau, services ${action || 'absents'}, progression et continuation SMTP`, {
    skip: !process.env.XNOVA_INSTALL_CHROMIUM && 'Définir XNOVA_INSTALL_CHROMIUM pour le test navigateur',
  }, t => browserScenario(t, action));
}
