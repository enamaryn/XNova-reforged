import test from 'node:test';
import assert from 'node:assert/strict';
import { networkInterfaces, tmpdir } from 'node:os';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { bootstrapListenHost, bootstrapUrls } from '../network.mjs';
import { createBootstrapServer } from '../server.mjs';
import { renderService } from '../config.mjs';
import { installService } from '../runner.mjs';

test('écoute réseau par défaut, avec restriction localhost facultative', () => {
  assert.equal(bootstrapListenHost(), '0.0.0.0');
  assert.equal(bootstrapListenHost('127.0.0.1'), '127.0.0.1');
  assert.throws(() => bootstrapListenHost('invalid'), /XNOVA_BOOTSTRAP_HOST/);
});

test('le terminal affiche les adresses IP du serveur, sans doublons ni interfaces internes', () => {
  const interfaces = {
    lo: [{ address: '127.0.0.1', internal: true }],
    eth0: [{ address: '192.168.1.119', internal: false }, { address: 'fe80::1', internal: false }],
    eth1: [{ address: '203.0.113.42', internal: false }, { address: '192.168.1.119', internal: false }],
  };
  assert.deepEqual(bootstrapUrls('0.0.0.0', interfaces), ['http://127.0.0.1:3000', 'http://192.168.1.119:3000', 'http://203.0.113.42:3000']);
  assert.deepEqual(bootstrapUrls('127.0.0.1', interfaces), ['http://127.0.0.1:3000']);
});

test('la première page est joignable par l’IP réseau et exige le code du terminal', async t => {
  const root = mkdtempSync(join(tmpdir(), 'xnova-network-'));
  const code = 'c'.repeat(64);
  const app = createBootstrapServer({ root, accessCode: code, install: async () => { throw new Error('Installation non attendue'); }, handoff: async () => {} });
  await new Promise(resolve => app.server.listen(0, bootstrapListenHost(), resolve));
  t.after(async () => {
    await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
    rmSync(root, { recursive: true, force: true });
  });
  // L'alias 127.0.0.2 vérifie aussi l'écoute hors 127.0.0.1 si aucune carte réseau n'est disponible.
  const address = Object.values(networkInterfaces()).flat().find(entry => !entry.internal && entry.family === 'IPv4')?.address || '127.0.0.2';
  const origin = `http://${address}:${app.server.address().port}`;
  assert.equal((await fetch(origin)).status, 200);
  assert.equal((await fetch(`${origin}/bootstrap/status`)).status, 401);
  const auth = await fetch(`${origin}/bootstrap/auth`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  assert.equal(auth.status, 200);
  const status = await fetch(`${origin}/bootstrap/status`, { headers: { Cookie: auth.headers.get('set-cookie').split(';')[0] } });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).phase, 'idle');
});

test('la reprise corrige le service web géré pour un proxy situé sur une autre machine', t => {
  const root = mkdtempSync(join(tmpdir(), 'xnova-service-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'xnova-web.service');
  const old = renderService('/opt/xnova', 'web', '/usr/bin/node');
  const next = renderService('/opt/xnova', 'web', '/usr/bin/node', { tls: 'proxy' });
  assert.match(old, /--hostname 127\.0\.0\.1/);
  assert.match(next, /--hostname 0\.0\.0\.0/);
  assert.match(renderService('/opt/xnova', 'web', '/usr/bin/node', { tls: 'certbot' }), /--hostname 127\.0\.0\.1/);
  installService(path, old, false);
  installService(path, next, false);
  assert.equal(readFileSync(path, 'utf8'), next);
  installService(path, next, false);
  assert.equal(readdirSync(root).length, 1);
  writeFileSync(path, 'service manuel');
  assert.throws(() => installService(path, next, false), /existent déjà/);
  assert.equal(readFileSync(path, 'utf8'), 'service manuel');
  installService(path, next, true);
  assert.equal(readFileSync(path, 'utf8'), next);
  const backup = readdirSync(root).find(name => name.includes('.before-xnova-'));
  assert.equal(readFileSync(join(root, backup), 'utf8'), 'service manuel');
  rmSync(path);
  symlinkSync(join(root, backup), path);
  assert.throws(() => installService(path, next, true), /non ordinaire/);
  assert.equal(readFileSync(join(root, backup), 'utf8'), 'service manuel');
});
