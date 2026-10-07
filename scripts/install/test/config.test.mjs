import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, statSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createConfiguration, writeConfiguration, readConfiguration, updateConfiguration, publicUrl, externalDatabaseUrl, renderService, renderProxy, managedFile } from '../config.mjs';

const options = { mode: 'production', url: 'https://jeu.example.org', database: 'local', tls: 'proxy' };
function directory(t) {
  const root = mkdtempSync(join(tmpdir(), 'xnova-install-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('base locale : identifiants cohérents, secrets distincts et reprise stable', t => {
  const root = directory(t);
  const config = createConfiguration(options);
  writeConfiguration(root, config);
  const restored = readConfiguration(root);
  assert.deepEqual(restored, config);
  const url = new URL(restored.env.DATABASE_URL);
  assert.equal(url.username, config.state.role);
  assert.equal(url.pathname, `/${config.state.databaseName}`);
  assert.match(url.password, /^[a-f0-9]{64}$/);
  assert.equal(new Set(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SECRETS_ENCRYPTION_KEY'].map(key => restored.env[key])).size, 3);
  assert.equal(restored.env.NEXT_PUBLIC_API_URL, '/api');
  assert.equal(restored.env.WEB_ORIGINS, options.url);
  assert.equal(restored.env.EMAIL_VERIFICATION_REQUIRED, 'true');
  assert.equal(statSync(join(root, '.env')).mode & 0o777, 0o600);
  assert.equal(statSync(join(root, '.xnova-install.json')).mode & 0o777, 0o600);
  assert.ok(!readFileSync(join(root, '.xnova-install.json'), 'utf8').includes(url.password));
  assert.deepEqual(updateConfiguration(root, config, { ...options, replaceServices: true }).env, config.env);
  assert.equal(readConfiguration(root).state.replaceServices, true);
});

test('URL externe : conservation des credentials, correction à la reprise et lecture shell sans expansion', t => {
  const root = directory(t);
  const databaseUrl = 'postgresql://user:p$ass%27word@db.example.org:5432/xnova?schema=public&sslmode=require';
  const config = createConfiguration({ ...options, database: 'external', databaseUrl });
  writeConfiguration(root, config);
  assert.equal(config.state.role, null);
  assert.equal(config.state.databaseName, null);
  const shell = spawnSync('bash', ['-c', 'set -a; . "$1"; node -e \'process.stdout.write(process.env.DATABASE_URL)\'', '_', join(root, '.env')], { encoding: 'utf8' });
  assert.equal(shell.status, 0);
  assert.equal(shell.stdout, config.env.DATABASE_URL);
  const next = updateConfiguration(root, config, { ...options, database: 'external', databaseUrl: 'postgresql://new:password@db.example.org/xnova' });
  assert.equal(next.env.JWT_SECRET, config.env.JWT_SECRET);
  assert.equal(next.env.SECRETS_ENCRYPTION_KEY, config.env.SECRETS_ENCRYPTION_KEY);
  assert.match(readConfiguration(root).env.DATABASE_URL, /^postgresql:\/\/new:/);
});

test('ne remplace pas une configuration manuelle et ne suit aucun lien symbolique', t => {
  const root = directory(t);
  const path = join(root, '.env');
  writeFileSync(path, 'installation manuelle');
  assert.throws(() => writeConfiguration(root, createConfiguration(options)), /présente/);
  assert.throws(() => readConfiguration(root), /existante ou incomplète/);
  assert.equal(readFileSync(path, 'utf8'), 'installation manuelle');
  rmSync(path);
  const victim = join(root, 'victim');
  writeFileSync(victim, 'conserver');
  symlinkSync(victim, path);
  assert.throws(() => writeConfiguration(root, createConfiguration(options)), /ordinaire/);
  assert.equal(readFileSync(victim, 'utf8'), 'conserver');
});

test('refuse les adresses injectables, HTTP en production et les choix incohérents', () => {
  for (const value of ['http://jeu.example.org', 'https://jeu.example.org/fr', 'https://u:p@jeu.example.org', 'https://jeu.example.org:444', 'https://bad_host.example.org', 'https://-bad.example.org', 'https://jeu.example.org?x=1', 'https://jeu.example.org/#secret']) {
    assert.throws(() => publicUrl(value, 'production'));
  }
  assert.throws(() => externalDatabaseUrl('file:///etc/passwd'));
  assert.throws(() => externalDatabaseUrl('postgresql://db.example.org'));
  assert.throws(() => createConfiguration({ ...options, tls: 'none' }));
  assert.throws(() => createConfiguration({ ...options, replaceServices: 'false' }));
  assert.throws(() => createConfiguration({ ...options, tls: 'certbot', email: '--debug' }));
  assert.equal(publicUrl('http://localhost', 'development'), 'http://localhost');
});

test('rend un proxy HTTP/WebSocket et adapte l’écoute du web à la position du proxy', t => {
  const root = directory(t);
  const config = createConfiguration(options);
  const proxy = renderProxy(config.state);
  assert.match(proxy, /server_name jeu\.example\.org;/);
  assert.match(proxy, /proxy_pass http:\/\/127\.0\.0\.1:3001\//);
  assert.match(proxy, /proxy_set_header Upgrade \$http_upgrade/);
  assert.match(renderService('/opt/xnova', 'web', '/usr/bin/node'), /start --hostname 127\.0\.0\.1/);
  assert.match(renderService('/opt/xnova', 'web', '/usr/bin/node', config.state), /start --hostname 0\.0\.0\.0/);
  assert.equal(config.env.API_HOST, '127.0.0.1');
  assert.match(renderService('/opt/xnova', 'api', '/usr/bin/node'), /User=xnova/);
  assert.throws(() => renderService('/opt/xnova\nExecStart=bad', 'api', '/usr/bin/node'));
  const path = join(root, 'nginx.conf');
  managedFile(path, proxy);
  writeFileSync(path, `${proxy}\n# Certbot additions\n`);
  managedFile(path, proxy);
  assert.match(readFileSync(path, 'utf8'), /Certbot additions/);
  writeFileSync(path, '# configuration manuelle');
  assert.throws(() => managedFile(path, proxy), /non gérée/);
});
