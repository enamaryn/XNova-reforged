import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request, Agent } from 'node:http';
import { createBootstrapServer } from '../server.mjs';
import { readConfiguration } from '../config.mjs';

const code = 'a'.repeat(64);
const settings = { mode: 'development', url: 'http://localhost', database: 'local', tls: 'none', replaceServices: false };
async function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'xnova-web-install-'));
  let executions = 0;
  const errors = [];
  const app = createBootstrapServer({ root, accessCode: code, install: async () => { executions++; return { setupRequired: true }; }, handoff: async () => {}, logError: e => errors.push(e), ...overrides });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => {
    await app.settled();
    await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
    rmSync(root, { recursive: true, force: true });
  });
  const send = (path, body, auth = {}, headers = {}) => fetch(`${origin}/bootstrap/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...auth, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const login = async () => {
    const response = await send('auth', { code });
    assert.equal(response.status, 200);
    const json = await response.json();
    return { Cookie: response.headers.get('set-cookie').split(';')[0], 'x-xnova-bootstrap-csrf': json.csrf };
  };
  return { root, app, origin, send, login, executions: () => executions, errors };
}

test('première page réellement servie sans dépendances, base ni fichiers générés', async t => {
  const f = await fixture(t);
  const response = await fetch(f.origin);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Créer une base locale automatiquement/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(f.executions(), 0);
  assert.equal(existsSync(join(f.root, '.env')), false);
  assert.equal((await f.send('status')).status, 401);
  assert.equal((await f.send('install', settings)).status, 401);
});

test('authentification, CSRF et validation bloquent toute écriture ou commande', async t => {
  const f = await fixture(t);
  assert.equal((await f.send('auth', { code: 'incorrect' })).status, 401);
  assert.equal((await f.send('auth', { code }, {}, { Origin: 'https://evil.example.org' })).status, 403);
  const auth = await f.login();
  assert.equal((await f.send('install', settings, { Cookie: auth.Cookie })).status, 403);
  assert.equal((await f.send('install', { ...settings, url: 'http://localhost/path' }, auth)).status, 400);
  assert.equal((await f.send('install', { ...settings, replaceServices: 'yes' }, auth)).status, 400);
  assert.equal(f.executions(), 0);
  assert.equal(existsSync(join(f.root, '.env')), false);
});

test('limitation des essais et expiration du code', async t => {
  let now = 0;
  const f = await fixture(t, { now: () => now });
  for (let i = 0; i < 10; i++) assert.equal((await f.send('auth', { code: 'bad' })).status, 401);
  assert.equal((await f.send('auth', { code })).status, 429);
  now = 61000;
  await f.login();
  now = 3 * 60 * 60 * 1000;
  assert.equal((await f.send('auth', { code })).status, 401);
});

test('parcours navigateur : config locale, aucun secret dans le suivi, transfert et fermeture', async t => {
  let released = false;
  const f = await fixture(t, { handoff: async () => { released = f.app.server.address() === null; } });
  const auth = await f.login();
  assert.equal((await f.send('install', settings, auth)).status, 202);
  await f.app.settled();
  const config = readConfiguration(f.root);
  const status = await (await f.send('status', undefined, auth)).json();
  assert.equal(status.phase, 'ready');
  assert.equal(f.executions(), 1);
  for (const secret of [config.env.JWT_SECRET, config.env.JWT_REFRESH_SECRET, new URL(config.env.DATABASE_URL).password, code]) assert.ok(!JSON.stringify(status).includes(secret));
  assert.equal((await f.send('install', settings, auth)).status, 409);
  const response = await f.send('handoff', {}, auth);
  assert.equal(response.status, 200);
  const target = new URL((await response.json()).next);
  assert.equal(target.pathname, '/setup');
  assert.equal(target.search, '');
  assert.equal(new URLSearchParams(target.hash.slice(1)).get('bootstrap-token'), code);
  assert.equal(released, true);
});

test('échec puis reprise : secrets stables et diagnostics sans fuite de l’URL externe', async t => {
  let count = 0;
  const secretUrl = 'postgresql://admin:private-password@db.example.org/xnova';
  const f = await fixture(t, { install: async (_config, _code, report) => {
    report('Connexion à la base');
    if (++count === 1) throw new Error(secretUrl);
    return { setupRequired: true };
  } });
  const auth = await f.login();
  const external = { ...settings, database: 'external', databaseUrl: secretUrl };
  assert.equal((await f.send('install', external, auth)).status, 202);
  await f.app.settled();
  const before = readConfiguration(f.root);
  const failed = await (await f.send('status', undefined, auth)).json();
  assert.equal(failed.phase, 'failed');
  assert.ok(!JSON.stringify(failed).includes('private-password'));
  assert.equal((await f.send('install', { ...external, databaseUrl: '' }, auth)).status, 202);
  await f.app.settled();
  assert.deepEqual(readConfiguration(f.root).env, before.env);
  assert.equal((await (await f.send('status', undefined, auth)).json()).phase, 'ready');
});

test('deux installations concurrentes ne créent pas deux configurations', async t => {
  let release;
  const f = await fixture(t, { install: () => new Promise(resolve => { release = () => resolve({ setupRequired: true }); }) });
  const auth = await f.login();
  const responses = await Promise.all([f.send('install', settings, auth), f.send('install', settings, auth)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [202, 409]);
  release();
  await f.app.settled();
});

test('services détectés : choix obligatoire et transmission de garder/supprimer à l’installation', async t => {
  for (const action of ['keep', 'recreate']) {
    let selected;
    const f = await fixture(t, {
      existingServices: () => ['xnova-api.service', 'xnova-web.service'],
      install: async config => { selected = config.state.replaceServices; return { setupRequired: true }; },
    });
    const unauthenticated = await f.send('status');
    assert.equal(unauthenticated.status, 401);
    assert.ok(!(await unauthenticated.text()).includes('xnova-api.service'));
    const auth = await f.login();
    const status = await (await f.send('status', undefined, auth)).json();
    assert.deepEqual(status.existingServices, ['xnova-api.service', 'xnova-web.service']);
    assert.equal((await f.send('install', settings, auth)).status, 400);
    assert.equal((await f.send('install', { ...settings, serviceAction: 'invalid' }, auth)).status, 400);
    assert.equal(existsSync(join(f.root, '.env')), false);
    assert.equal((await f.send('install', { ...settings, serviceAction: action }, auth)).status, 202);
    await f.app.settled();
    assert.equal(selected, action === 'keep');
    assert.equal(readConfiguration(f.root).state.replaceServices, action === 'keep');
  }
});

test('un proxy avec keep-alive reçoit le nouveau site après le transfert du port', async t => {
  let web;
  const f = await fixture(t, { handoff: async () => {
    const port = new URL(f.origin).port;
    web = createServer((_req, res) => res.end('site applicatif'));
    await new Promise(resolve => web.listen(Number(port), '127.0.0.1', resolve));
  } });
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  t.after(async () => {
    agent.destroy();
    if (web) await new Promise(resolve => web.close(resolve));
  });
  const proxied = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request(`${f.origin}${path}`, { agent, method: body === undefined ? 'GET' : 'POST', headers: { Origin: f.origin, 'Content-Type': 'application/json', ...headers } }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const login = await proxied('/bootstrap/auth', { code });
  const auth = { Cookie: login.headers['set-cookie'][0].split(';')[0], 'x-xnova-bootstrap-csrf': JSON.parse(login.text).csrf };
  assert.equal((await proxied('/bootstrap/install', settings, auth)).status, 202);
  await f.app.settled();
  assert.equal((await proxied('/bootstrap/handoff', {}, auth)).status, 200);
  assert.equal((await proxied('/setup')).text, 'site applicatif');
});
