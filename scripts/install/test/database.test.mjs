import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfiguration } from '../config.mjs';
import { command, prepareLocalDatabase, waitForJson } from '../runner.mjs';
import { createServer } from 'node:http';

test('la vérification attend une vraie connexion DB, pas seulement une réponse HTTP 200', async t => {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'error', database: { status: 'disconnected' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(waitForJson(`http://127.0.0.1:${server.address().port}/health`, json => json.status === 'ok' && json.database.status === 'connected', { attempts: 2, delay: 1 }), /non prêt/);
});

test('création PostgreSQL locale réelle, authentification et reprise sans changement de mot de passe', {
  skip: !process.env.XNOVA_INSTALL_POSTGRES_CONTAINER && 'Définir XNOVA_INSTALL_POSTGRES_CONTAINER pour le test PostgreSQL isolé',
}, async t => {
  const container = process.env.XNOVA_INSTALL_POSTGRES_CONTAINER;
  const admin = process.env.XNOVA_INSTALL_POSTGRES_ADMIN || 'postgres';
  const config = createConfiguration({ mode: 'development', url: 'http://localhost', database: 'local', tls: 'none' });
  const privileged = (sql) => command('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', admin, '-d', 'postgres'], { input: sql, capture: true });
  t.after(() => privileged(`DROP DATABASE IF EXISTS "${config.state.databaseName}" WITH (FORCE); DROP ROLE IF EXISTS "${config.state.role}";`));
  const run = (program, args, options) => {
    if (program === 'runuser') return privileged(options.input);
    assert.equal(program, 'psql');
    return command('docker', ['exec', '-e', 'PGPASSWORD', container, 'psql', ...args], { ...options, capture: true });
  };
  await prepareLocalDatabase(config, run);
  await prepareLocalDatabase(config, run);
  const password = new URL(config.env.DATABASE_URL).password;
  const result = await command('docker', ['exec', '-e', 'PGPASSWORD', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', config.state.role, '-d', config.state.databaseName, '-Atc', 'CREATE TABLE bootstrap_probe (id integer); INSERT INTO bootstrap_probe VALUES (42); SELECT id FROM bootstrap_probe;'], {
    env: { ...process.env, PGPASSWORD: password }, capture: true,
  });
  assert.match(result, /\b42\b/);
});
