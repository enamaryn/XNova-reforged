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
  await page.route(`http://${address}/fr/setup`, route => route.fulfill({ contentType: 'text/html', body: '<h1>Configuration SMTP</h1>' }));
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

async function openWizard(t, overrides = {}) {
  const { chromium } = await import('@playwright/test');
  const root = mkdtempSync(join(tmpdir(), 'xnova-install-ui-'));
  const code = 'c'.repeat(64);
  const logs = [];
  const app = createBootstrapServer({ root, accessCode: code, existingServices: () => overrides.services || [], install: async (_c, _code, report) => { report('Création de la base locale'); return { setupRequired: true }; }, handoff: async () => {}, log: line => logs.push(line), ...overrides.server });
  await new Promise(resolve => app.server.listen(0, bootstrapListenHost(), resolve));
  const browser = await chromium.launch({ executablePath: process.env.XNOVA_INSTALL_CHROMIUM, args: ['--no-sandbox', '--no-proxy-server'] });
  t.after(async () => {
    await browser.close();
    await app.settled();
    await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
    rmSync(root, { recursive: true, force: true });
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 500 } });
  const address = Object.values(networkInterfaces()).flat().find(entry => !entry.internal && entry.family === 'IPv4')?.address || '127.0.0.2';
  await page.goto(`http://${address}:${app.server.address().port}`);
  return { page, code, logs, root, address, app };
}

test('navigateur : la langue se choisit avant le code, change tout de suite et accompagne le site', {
  skip: !process.env.XNOVA_INSTALL_CHROMIUM && 'Définir XNOVA_INSTALL_CHROMIUM pour le test navigateur',
}, async t => {
  const { page, code } = await openWizard(t);
  // Cinq drapeaux visibles dès le départ, avant la saisie du code
  assert.deepEqual(await page.locator('#languages button').allInnerTexts(), ['🇫🇷 Français', '🇬🇧 English', '🇪🇸 Español', '🇩🇪 Deutsch', '🇮🇹 Italiano']);
  assert.equal(await page.locator('#languages button[aria-pressed="true"]').innerText(), '🇫🇷 Français');
  const expectations = { en: ['Let’s install your server.', 'Temporary access code', 'Open the wizard'], es: ['Instalemos su servidor.', 'Código de acceso temporal', 'Abrir el asistente'], de: ['Richten wir Ihren Server ein.', 'Temporärer Zugangscode', 'Assistenten öffnen'], it: ['Installiamo il tuo server.', 'Codice di accesso temporaneo', 'Apri l’assistente'] };
  const names = { en: 'English', es: 'Español', de: 'Deutsch', it: 'Italiano' };
  for (const [id, [title, label, button]] of Object.entries(expectations)) {
    await page.getByRole('button', { name: names[id] }).click();
    assert.equal(await page.locator('h1').innerText(), title);
    assert.equal(await page.locator('label[for="code"]').innerText(), label);
    assert.equal(await page.locator('#auth-button').innerText(), button);
    assert.equal(await page.evaluate(() => document.documentElement.lang), id);
  }
  // Choix mémorisé pour le site (cookie NEXT_LOCALE) puis la saisie du code garde la langue
  await page.getByRole('button', { name: 'Deutsch' }).click();
  assert.match(await page.evaluate(() => document.cookie), /NEXT_LOCALE=de/);
  await page.locator('#code').fill(code);
  await page.locator('#auth-button').click();
  await page.locator('#install-button').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#install-button').innerText(), 'Server vorbereiten');
  assert.equal(await page.locator('label[for="url"]').innerText(), 'Öffentliche Adresse der Seite');
});

test('navigateur : une erreur ne reste jamais muette ni hors écran (champ manquant, services, réseau, proxy)', {
  skip: !process.env.XNOVA_INSTALL_CHROMIUM && 'Définir XNOVA_INSTALL_CHROMIUM pour le test navigateur',
}, async t => {
  const { page, code, logs, root } = await openWizard(t, { services: ['xnova-api.service', 'xnova-web.service'] });
  const visibleError = async text => {
    const box = page.locator('#error');
    await box.waitFor({ state: 'visible' });
    assert.match(await box.innerText(), text);
    const rect = await box.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height, 'le message est dans la zone visible');
  };
  await page.locator('#code').fill('');
  await page.locator('#auth-button').click();
  await visibleError(/code d’accès/);
  await page.locator('#code').fill(code);
  await page.locator('#auth-button').click();
  await page.locator('#install-button').waitFor({ state: 'visible' });

  // Bouton tout en bas du formulaire long : l'erreur reste visible malgré le défilement
  await page.locator('#install-button').scrollIntoViewIfNeeded();
  await page.locator('#url').fill('');
  await page.locator('#install-button').click();
  await visibleError(/adresse publique/);
  await page.locator('#url').fill('https://jeu.exemple.fr');
  await page.locator('#install-button').click();
  await visibleError(/Garder et reprendre/);
  assert.equal(readConfiguration(root), null, 'rien n’est écrit tant que le formulaire est incomplet');
  await page.getByRole('radio', { name: 'Supprimer et recréer' }).check();
  await page.locator('#tls').selectOption('certbot');
  await page.locator('#install-button').click();
  await visibleError(/email/);
  await page.locator('#tls').selectOption('proxy');
  await page.locator('#database').selectOption('external');
  await page.locator('#install-button').click();
  await visibleError(/PostgreSQL/);
  await page.locator('#database').selectOption('local');

  // Réseau coupé : message explicite plutôt que du silence
  await page.route('**/bootstrap/install', route => route.abort());
  await page.locator('#install-button').click();
  await visibleError(/Impossible de joindre l’assistant/);
  // Proxy qui renvoie une page HTML : message explicite avec le code HTTP
  await page.unroute('**/bootstrap/install');
  await page.route('**/bootstrap/install', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Bad gateway</h1>' }));
  await page.locator('#install-button').click();
  await visibleError(/HTTP 502/);
  assert.equal(await page.locator('#install-button').isEnabled(), true, 'le bouton est de nouveau utilisable');

  // Succès : le terminal du serveur reçoit un compte rendu de chaque étape
  await page.unroute('**/bootstrap/install');
  await page.locator('#install-button').click();
  await page.locator('#continue').waitFor({ state: 'visible' });
  const terminal = logs.join('\n');
  assert.match(terminal, /installation demandée \(mode production, adresse https:\/\/jeu\.exemple\.fr, base local, accès proxy, langue fr, services : recreate\)/);
  assert.match(terminal, /configuration enregistrée/);
  assert.match(terminal, /→ Création de la base locale/);
  assert.ok(!terminal.includes(code), 'le code d’accès n’apparaît jamais dans le journal');
});
