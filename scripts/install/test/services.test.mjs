import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findExistingServices, resetServices, installService } from '../runner.mjs';
import { renderService } from '../config.mjs';

test('détection des définitions et drop-ins, y compris des liens devenus invalides', t => {
  const root = mkdtempSync(join(tmpdir(), 'xnova-detect-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(findExistingServices([root]), []);
  symlinkSync(join(root, 'missing'), join(root, 'xnova-api.service'));
  mkdirSync(join(root, 'xnova-web.service.d'));
  assert.deepEqual(findExistingServices([root]), ['xnova-api.service', 'xnova-web.service']);
});

test('suppression : arrêt, désactivation, retrait des anciennes unités/drop-ins puis recréation', async t => {
  const root = mkdtempSync(join(tmpdir(), 'xnova-reset-services-'));
  const outside = mkdtempSync(join(tmpdir(), 'xnova-service-target-'));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); });
  for (const name of ['xnova-api.service', 'xnova-web.service', 'ssh.service']) writeFileSync(join(root, name), `ancien ${name}`);
  mkdirSync(join(root, 'xnova-api.service.d'));
  writeFileSync(join(root, 'xnova-api.service.d', 'override.conf'), 'ancien chemin');
  writeFileSync(join(outside, 'config.conf'), 'conserver la cible');
  symlinkSync(outside, join(root, 'xnova-web.service.d'));
  const calls = [];
  let listed = true;
  const run = async (program, args) => {
    assert.equal(program, 'systemctl');
    calls.push(args);
    if (['list-unit-files', 'list-units'].includes(args[0])) {
      assert.ok(args.includes('xnova-api.service') && args.includes('xnova-web.service'));
      return listed ? 'xnova-api.service enabled\nxnova-web.service failed\nssh.service enabled\n' : '';
    }
    if (args[0] === 'stop') assert.equal(readFileSync(join(root, args[1]), 'utf8'), `ancien ${args[1]}`);
    return '';
  };
  await resetServices(run, [root]);
  assert.deepEqual(findExistingServices([root]), []);
  assert.equal(readFileSync(join(root, 'ssh.service'), 'utf8'), 'ancien ssh.service');
  assert.equal(readFileSync(join(outside, 'config.conf'), 'utf8'), 'conserver la cible');
  assert.equal(existsSync(join(root, 'xnova-api.service.d')), false);
  assert.equal(calls.filter(args => args[0] === 'stop').length, 2);
  assert.ok(calls.every(args => !args.includes('ssh.service')));
  assert.deepEqual(calls.at(-1), ['daemon-reload']);
  listed = false;
  const previousStops = calls.filter(args => args[0] === 'stop').length;
  await resetServices(run, [root]);
  assert.equal(calls.filter(args => args[0] === 'stop').length, previousStops);
  const content = renderService('/opt/xnova', 'api', '/usr/bin/node');
  installService(join(root, 'xnova-api.service'), content, false);
  assert.equal(readFileSync(join(root, 'xnova-api.service'), 'utf8'), content);
});
