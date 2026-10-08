import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { updateInstallation, commandRunner } from '../update.mjs';

const command = commandRunner();
async function fixture(t, failure, { inactive = [], differentUser = false, badDirectory = false, npmVersion = '10.9.4' } = {}) {
  const temp = await mkdtemp(join(tmpdir(), 'xnova-update-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = join(temp, 'installation'), origin = join(temp, 'origin.git'), work = join(temp, 'publisher');
  await command('git', ['init', '--bare', '--initial-branch=main', origin], { capture: true });
  await command('git', ['init', '-b', 'main', work], { capture: true });
  const git = args => command('git', args, { cwd: work, capture: true });
  await git(['config', 'user.name', 'Update Test']); await git(['config', 'user.email', 'update@example.test']);
  for (const dir of ['apps/api', 'apps/web', 'scripts', 'packages/database']) await mkdir(join(work, dir), { recursive: true });
  await writeFile(join(work, '.gitignore'), '.env\n.xnova-install.json\nbackups/\nnode_modules/\n');
  for (const file of ['apps/api/.keep', 'apps/web/.keep', 'packages/database/.keep', 'scripts/backup-db.sh']) await writeFile(join(work, file), 'fixture');
  await writeFile(join(work, 'version'), 'v1'); await git(['add', '.']); await git(['commit', '-m', 'initial']);
  await git(['remote', 'add', 'origin', origin]); await git(['push', '-u', 'origin', 'main']);
  await command('git', ['clone', '--branch', 'main', origin, root], { capture: true });
  const previous = (await command('git', ['rev-parse', 'HEAD'], { cwd: root, capture: true })).trim();
  const config = 'NODE_ENV=development\nDATABASE_URL="postgresql://fixture:secret@localhost/players"\nAPI_PORT=3001\nPORT=3000\nJWT_SECRET=keep-this-secret\n';
  await writeFile(join(root, '.env'), config, { mode: 0o600 });
  await writeFile(join(root, '.xnova-install.json'), '{"installed":true}', { mode: 0o600 });
  await writeFile(join(root, 'packages/database/.env'), 'DATABASE_URL=preserved\n', { mode: 0o600 });
  const calls = [], logs = [], active = new Set(['xnova-api', 'xnova-web'].filter(unit => !inactive.includes(unit)));
  let backedUp = false;
  const run = async (program, args, options = {}) => {
    if (program === 'runuser') { program = args[3]; args = args.slice(4); assert.equal(options.cwd, root); }
    calls.push([program, ...args]);
    if (program === 'systemctl') {
      if (args[0] === 'show') {
        if (args[2] === '--property=LoadState') return 'loaded\n';
        if (args[2] === '--property=User') return differentUser && args[1] === 'xnova-web' ? 'other\n' : 'xnova\n';
        return (badDirectory ? work : join(root, 'apps', args[1] === 'xnova-api' ? 'api' : 'web')) + '\n';
      }
      if (args[0] === 'is-active') { if (!active.has(args.at(-1))) throw new Error('inactive'); return ''; }
      if (args[0] === 'stop') { args.slice(1).forEach(unit => active.delete(unit)); return ''; }
      if (args[0] === 'start') { args.slice(1).forEach(unit => active.add(unit)); return ''; }
    }
    if (program === 'bash' && args[0] === '-c' && args[1].startsWith('command -v git')) return '/fixture/tools\n';
    if (program === 'bash' && args[0] === 'scripts/backup-db.sh') {
      assert.equal(active.size, 0, 'backup occurs while both services are stopped');
      assert.equal((await readFile(join(root, 'version'), 'utf8')), 'v1');
      if (failure === 'backup') throw new Error('backup failed');
      const path = join(root, 'backups', 'xnova_backup_fixture.sql.gz');
      await writeFile(path, gzipSync('players preserved; PostgreSQL database dump complete')); backedUp = true;
      return `OK: sauvegarde créée et vérifiée : ${path} (1K)\n`;
    }
    if (program === 'npm' && args[0] === '--version') return (options.env?.PATH?.startsWith('/fixture/npm10/bin:') ? '10.9.4' : npmVersion) + '\n';
    if (program === 'npx' && args[0] === '--yes') return '/fixture/npm10/bin:' + process.env.PATH;
    if (program === 'npm' || (program === 'npx' && args[0] === '--yes')) {
      if (args.includes('ci')) { assert.ok(backedUp); if (failure === 'dependencies') throw new Error('npm failed'); }
      return '';
    }
    if (program === 'bash' && args[0] === '-c' && args[1].includes('source .env')) {
      const actual = args[3], rest = args.slice(4);
      if (actual === 'node') return command(program, args, { ...options, cwd: root });
      assert.ok(backedUp);
      if (npmVersion.startsWith('11.')) assert.ok(options.env.PATH.startsWith('/fixture/npm10/bin:'));
      assert.equal((await readFile(join(root, '.env'), 'utf8')), config);
      if (rest.includes('build') && failure === 'build') throw new Error('build failed');
      if (rest.includes('deploy') && failure === 'migration') throw new Error('migration failed');
      if (rest.includes('deploy')) assert.ok(calls.some(call => call.includes('build')));
      return '';
    }
    return command(program, args, { ...options, cwd: options.cwd || root });
  };
  const health = async ({ apiPort, webPort }) => {
    assert.equal(apiPort, '3001'); assert.equal(webPort, '3000');
    assert.ok(active.has('xnova-api') && active.has('xnova-web'));
    if (failure === 'health') throw new Error('health failed');
    if (failure === 'web-stopped') active.delete('xnova-web');
  };
  const publish = async () => { await writeFile(join(work, 'version'), 'v2'); await git(['add', 'version']); await git(['commit', '-m', 'update']); await git(['push']); };
  return { root, work, previous, config, publish, git, calls, logs, active, options: { root, run, log: line => logs.push(line), health } };
}

test('real Git fast-forward, backup before code/dependencies, configuration preserved and private snapshot', async t => {
  const f = await fixture(t); await f.publish();
  const result = await updateInstallation(f.options);
  assert.equal(await readFile(join(f.root, 'version'), 'utf8'), 'v2');
  assert.equal(await readFile(join(f.root, '.env'), 'utf8'), f.config);
  assert.equal(await readFile(join(result.snapshot, '.env'), 'utf8'), f.config);
  assert.equal(await readFile(join(result.snapshot, '.xnova-install.json'), 'utf8'), '{"installed":true}');
  assert.equal(await readFile(join(result.snapshot, 'database.env'), 'utf8'), 'DATABASE_URL=preserved\n');
  assert.equal((await stat(result.snapshot)).mode & 0o777, 0o700);
  assert.equal((await stat(join(result.snapshot, '.env'))).mode & 0o777, 0o600);
  assert.equal((await stat(join(result.snapshot, 'database.sql.gz'))).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(join(result.snapshot, 'update.json'), 'utf8')).status, 'success');
  assert.equal(f.active.size, 2);
  const builds = f.calls.filter(call => call.includes('build'));
  assert.deepEqual(builds.map(call => call.at(-1)), ['--workspace=@xnova/game-config', '--workspace=@xnova/game-engine', '--workspace=@xnova/api', '--workspace=@xnova/web']);
  assert.ok(builds.at(-1).includes('NODE_ENV=production'));
  assert.ok(!f.calls.some(call => call.includes('reset') || call.includes('push') || call.includes('disable')));
  assert.ok(!f.logs.join('\n').includes('keep-this-secret'));
});

test('--check fetches but never stops services or changes checkout', async t => {
  const f = await fixture(t); await f.publish();
  const result = await updateInstallation({ ...f.options, check: true });
  assert.notEqual(result.previous, result.target);
  assert.equal(await readFile(join(f.root, 'version'), 'utf8'), 'v1');
  assert.ok(!f.calls.some(call => call.includes('stop') || call.includes('ci')));
});

test('same Git version is still compiled, including after a manual git pull', async t => {
  const f = await fixture(t);
  assert.equal((await updateInstallation(f.options)).changed, true);
  assert.ok(f.calls.some(call => call.includes('ci')));
});

for (const failure of ['backup', 'dependencies', 'build', 'migration', 'health', 'web-stopped']) {
  test(`failure ${failure}: no silent success, correct service state and recoverable metadata`, async t => {
    const f = await fixture(t, failure); await f.publish();
    await assert.rejects(updateInstallation(f.options), /Mise à jour interrompue/);
    assert.equal(f.active.size, failure === 'backup' ? 2 : 0);
    assert.equal(await readFile(join(f.root, 'version'), 'utf8'), failure === 'backup' ? 'v1' : 'v2');
    assert.equal(await readFile(join(f.root, '.env'), 'utf8'), f.config);
    if (['backup', 'dependencies', 'build'].includes(failure)) assert.ok(!f.calls.some(call => call.includes('deploy')));
    const snapshot = f.logs.find(line => line.startsWith('Sauvegarde de reprise : ')).slice('Sauvegarde de reprise : '.length);
    assert.equal(JSON.parse(await readFile(join(snapshot, 'update.json'), 'utf8')).status, 'failed');
  });
}

test('backup failure restores only services that were originally active', async t => {
  const f = await fixture(t, 'backup', { inactive: ['xnova-web'] }); await f.publish();
  await assert.rejects(updateInstallation(f.options));
  assert.deepEqual([...f.active], ['xnova-api']);
});

for (const kind of ['dirty', 'untracked', 'branch', 'divergent', 'different-user', 'wrong-clone', 'remote-env']) {
  test(`preflight refuses ${kind} before stopping services`, async t => {
    const f = await fixture(t, undefined, { differentUser: kind === 'different-user', badDirectory: kind === 'wrong-clone' });
    await f.publish();
    if (kind === 'dirty') await writeFile(join(f.root, 'version'), 'local changes');
    if (kind === 'untracked') await writeFile(join(f.root, 'local-file'), 'keep me');
    if (kind === 'branch') await command('git', ['switch', '-c', 'feature'], { cwd: f.root, capture: true });
    if (kind === 'divergent') {
      await command('git', ['config', 'user.name', 'Local'], { cwd: f.root }); await command('git', ['config', 'user.email', 'local@example.test'], { cwd: f.root });
      await writeFile(join(f.root, 'version'), 'local commit'); await command('git', ['commit', '-am', 'local'], { cwd: f.root, capture: true });
    }
    if (kind === 'remote-env') { await writeFile(join(f.work, '.env'), 'bad'); await f.git(['add', '-f', '.env']); await f.git(['commit', '-m', 'bad config']); await f.git(['push']); }
    await assert.rejects(updateInstallation(f.options));
    assert.ok(!f.calls.some(call => call.includes('stop'))); assert.equal(f.active.size, 2);
  });
}

test('npm 11 uses npm 10 privately without a global installation', async t => {
  const f = await fixture(t, undefined, { npmVersion: '11.6.0' }); await f.publish();
  await updateInstallation(f.options);
  assert.ok(f.calls.some(call => call[0] === 'npx' && call.includes('--package=npm@10.9.4') && call.includes('node')));
  assert.ok(!f.calls.some(call => call.includes('--global') || call.includes('-g')));
});

test('interruption terminates the command and permits an independent cleanup command', async () => {
  const controller = new AbortController();
  const running = commandRunner(controller.signal)('node', ['-e', 'setInterval(()=>{},1000)'], { capture: true });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(running, /interrompue/);
  assert.equal(await commandRunner()('node', ['-e', 'process.stdout.write("cleanup")'], { capture: true }), 'cleanup');
});

test('help works without sudo and does not invoke an installation', async () => {
  const output = await command('bash', ['scripts/update.sh', '--help'], { cwd: resolveRoot(), capture: true });
  assert.match(output, /sudo bash scripts\/update.sh/);
});
function resolveRoot() { return new URL('../../..', import.meta.url).pathname; }
