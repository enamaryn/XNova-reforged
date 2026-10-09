// Test complet Ubuntu 24.04 / systemd, exclusivement sur une machine CI jetable.
// Il démarre la première page sans npm ni DB, installe vraiment, puis teste un envoi SMTP réel.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { statSync, writeFileSync, mkdirSync, existsSync, readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { command } from '../runner.mjs';
import { readConfiguration } from '../config.mjs';

if (process.env.XNOVA_INSTALL_SMOKE !== 'disposable-ci' || process.getuid?.() !== 0) {
  throw new Error('Ce test modifie le système : XNOVA_INSTALL_SMOKE=disposable-ci et root sont requis.');
}
const root = process.cwd();
// Reproduire les services laissés par la suppression du clone : actifs, non gérés,
// avec un ancien override. Leur lancement ne réserve pas le port du bootstrap.
for (const component of ['api', 'web']) {
  writeFileSync(`/etc/systemd/system/xnova-${component}.service`, '[Unit]\nDescription=Ancien XNova\n[Service]\nExecStart=/usr/bin/sleep infinity\n[Install]\nWantedBy=multi-user.target\n');
}
mkdirSync('/etc/systemd/system/xnova-api.service.d', { recursive: true });
writeFileSync('/etc/systemd/system/xnova-api.service.d/old.conf', '[Service]\nEnvironment=XNOVA_OLD_SERVICE=1\n');
for (const args of [['daemon-reload'], ['enable', '--now', 'xnova-api', 'xnova-web']]) {
  assert.equal(spawnSync('systemctl', args).status, 0, 'Préparer les anciens services du test.');
}
const bootstrap = spawn('bash', ['scripts/install.sh'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
let accessCode;
let exit;
bootstrap.stdout.on('data', chunk => {
  output = (output + chunk).slice(-32000);
  accessCode ||= output.match(/^([a-f0-9]{64})$/m)?.[1];
});
bootstrap.stderr.on('data', chunk => { output = (output + chunk).slice(-32000); });
bootstrap.on('exit', code => { exit = code; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const address = Object.values(networkInterfaces()).flat().find(entry => !entry.internal && entry.family === 'IPv4')?.address;
assert.ok(address, 'Une interface réseau non locale est nécessaire pour ce test CI.');
const web = `http://${address}`;
const origin = `${web}:3000`;
let auth = {};
let updateTemp;
async function call(base, path, body, method = body === undefined ? 'GET' : 'POST', headers = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(path.endsWith('/handoff') ? 150000 : 10000),
  });
}

const messages = [];
const smtp = createServer(socket => {
  socket.write('220 localhost XNova installation test\r\n');
  let buffer = '', data = false, message = [];
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const index = buffer.indexOf('\r\n');
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (data) {
        if (line === '.') {
          messages.push(message.join('\r\n')); message = []; data = false;
          socket.write('250 message accepted\r\n');
        } else message.push(line.startsWith('..') ? line.slice(1) : line);
      } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250 PIPELINING\r\n');
      else if (/^DATA$/i.test(line)) { data = true; socket.write('354 send message\r\n'); }
      else if (/^QUIT$/i.test(line)) socket.end('221 goodbye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
try {
  for (let i = 0; !accessCode && i < 120; i++) {
    if (exit !== undefined) throw new Error('Le lanceur a échoué.');
    await sleep(1000);
  }
  assert.ok(accessCode, 'Le lanceur doit afficher un code temporaire.');
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Créer une base locale automatiquement/);
  assert.equal((await call(origin, '/bootstrap/status')).status, 401);
  assert.ok(output.includes(origin), 'Le terminal affiche l’adresse réseau utilisée.');
  console.log('PASS : première page joignable par l’IP réseau, sans dépendances ni base, protégée par un code.');

  const login = await call(origin, '/bootstrap/auth', { code: accessCode });
  assert.equal(login.status, 200);
  auth = { Cookie: login.headers.get('set-cookie').split(';')[0], 'x-xnova-bootstrap-csrf': (await login.json()).csrf };
  const detected = await (await call(origin, '/bootstrap/status', undefined, 'GET', auth)).json();
  assert.deepEqual(detected.existingServices, ['xnova-api.service', 'xnova-web.service']);
  const response = await call(origin, '/bootstrap/install', { mode: 'development', url: web, database: 'local', tls: 'none', serviceAction: 'recreate' }, 'POST', auth);
  assert.equal(response.status, 202);
  let status;
  let lastStage;
  for (let i = 0; i < 1200; i++) {
    status = await (await call(origin, '/bootstrap/status', undefined, 'GET', auth)).json();
    if (status.stage !== lastStage) { console.log(`Étape : ${status.stage}`); lastStage = status.stage; }
    if (status.phase === 'failed') throw new Error(status.error);
    if (status.phase === 'ready') break;
    await sleep(1000);
  }
  assert.equal(status.phase, 'ready');
  assert.equal(existsSync('/etc/systemd/system/xnova-api.service.d'), false);
  assert.match(readFileSync('/etc/systemd/system/xnova-api.service', 'utf8'), /dist\/main\.js/);
  console.log('PASS : anciens services et override supprimés, services recréés.');
  const config = readConfiguration(root);
  assert.equal(statSync(`${root}/.env`).mode & 0o777, 0o600);
  assert.equal(new URL(config.env.DATABASE_URL).username, config.state.role);
  console.log('PASS : base locale, secrets, migrations, compilation et API fonctionnels.');

  const transfer = await call(origin, '/bootstrap/handoff', {}, 'POST', auth);
  assert.equal(transfer.status, 200);
  const next = new URL((await transfer.json()).next);
  assert.equal(next.origin, web);
  assert.equal(new URLSearchParams(next.hash.slice(1)).get('bootstrap-token'), accessCode);
  const rendered = await fetch(`${web}/fr/setup`);
  assert.equal(rendered.status, 200);
  assert.match(await rendered.text(), /Installation du serveur/);
  assert.equal((await call(web, '/bootstrap/status', undefined, 'GET', auth)).status, 404);
  // En mode nginx local, le port temporaire n'est plus exposé sur l'IP réseau après le relais.
  await assert.rejects(fetch(`${origin}/bootstrap/status`, { signal: AbortSignal.timeout(2000) }));
  console.log('PASS : relais vers Next et arrêt du service d’installation privilégié.');

  const tokenHeaders = { 'x-setup-token': accessCode };
  assert.equal((await call(web, '/api/setup/smtp', { host: '127.0.0.1', port: smtp.address().port, secure: false, fromEmail: 'xnova@example.test', fromName: 'XNova installation' }, 'PUT', tokenHeaders)).status, 200);
  assert.equal((await call(web, '/api/setup/smtp/test', { to: 'admin@example.test' }, 'POST', tokenHeaders)).status, 200);
  assert.equal(messages.length, 1);
  assert.equal((await call(web, '/api/setup/settings', {}, 'PUT', tokenHeaders)).status, 200);
  assert.equal((await call(web, '/api/setup/admin', { username: 'fresh_admin', email: 'admin@example.test', password: 'FreshAdmin1234!' }, 'POST', tokenHeaders)).status, 200);
  assert.equal(messages.length, 2);
  const mail = messages[1].replace(/=\r\n/g, '').replace(/=([a-f0-9]{2})/gi, (_all, hex) => String.fromCharCode(parseInt(hex, 16)));
  const link = mail.match(/http:\/\/[^\s<>]+\/verify-email\?token=[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/)?.[0];
  assert.ok(link, 'Lien de confirmation réellement reçu par SMTP.');
  const confirmationUrl = new URL(link);
  assert.equal(confirmationUrl.origin, web);
  const confirmation = confirmationUrl.searchParams.get('token');
  assert.equal((await call(web, '/api/auth/verify-email', { token: confirmation })).status, 200);
  assert.equal((await (await call(web, '/api/setup/status')).json()).setupRequired, false);
  assert.equal((await call(web, '/api/setup/state', undefined, 'GET', tokenHeaders)).status, 404);
  console.log('PASS : SMTP réel, compte super admin confirmé et assistant verrouillé.');

  // Publication locale uniquement : aucune écriture dans le dépôt GitHub.
  updateTemp = mkdtempSync('/tmp/xnova-update-smoke-');
  await command('chown', ['xnova:xnova', updateTemp]);
  const asUser = (program, args, cwd = root) => command('runuser', ['-u', 'xnova', '--', program, ...args], { cwd, capture: true });
  const git = args => asUser('git', args);
  const envBefore = readFileSync(`${root}/.env`, 'utf8');
  const stateBefore = readFileSync(`${root}/.xnova-install.json`, 'utf8');
  const servicesBefore = ['api', 'web'].map(part => readFileSync(`/etc/systemd/system/xnova-${part}.service`, 'utf8'));
  const previous = (await git(['rev-parse', 'HEAD'])).trim();
  await git(['switch', '-C', 'main', 'HEAD']);
  const remote = `${updateTemp}/origin.git`, publisher = `${updateTemp}/publisher`;
  await asUser('git', ['init', '--bare', '--initial-branch=main', remote]);
  await git(['remote', 'set-url', 'origin', remote]);
  await git(['push', '-u', 'origin', 'main']);
  await asUser('git', ['clone', remote, publisher]);
  await asUser('bash', ['-c', 'printf "update smoke\\n" > docs/update-smoke.txt'], publisher);
  await asUser('git', ['add', 'docs/update-smoke.txt'], publisher);
  await asUser('git', ['-c', 'user.name=Update CI', '-c', 'user.email=update@example.test', 'commit', '-m', 'Local update fixture'], publisher);
  await asUser('git', ['push'], publisher);
  const target = (await asUser('git', ['rev-parse', 'HEAD'], publisher)).trim();
  const installedVersion = async () => {
    const response = await call(web, '/build-version.json');
    assert.equal(response.status, 200, 'Métadonnées du build accessibles derrière nginx');
    return response.json();
  };
  const adminLogin = () => call(web, '/api/auth/login', { identifier: 'fresh_admin', password: 'FreshAdmin1234!' });
  assert.equal((await adminLogin()).status, 200);
  assert.equal((await installedVersion()).commit, previous);
  await command('bash', ['scripts/update.sh', '--check'], { cwd: root });
  assert.equal((await installedVersion()).commit, previous);
  assert.equal((await git(['rev-parse', 'HEAD'])).trim(), previous);
  await command('bash', ['scripts/update.sh'], { cwd: root });
  assert.equal((await git(['rev-parse', 'HEAD'])).trim(), target);
  assert.equal((await installedVersion()).commit, target);
  assert.ok((await (await fetch(`${web}/fr/login`)).text()).includes(target.slice(0, 7)));
  assert.equal(readFileSync(`${root}/.env`, 'utf8'), envBefore);
  assert.equal(readFileSync(`${root}/.xnova-install.json`, 'utf8'), stateBefore);
  for (const [index, part] of ['api', 'web'].entries()) {
    assert.equal(readFileSync(`/etc/systemd/system/xnova-${part}.service`, 'utf8'), servicesBefore[index]);
    await command('systemctl', ['is-active', '--quiet', `xnova-${part}`]);
  }
  const snapshots = readdirSync(`${root}/backups`).filter(name => name.startsWith('update-'));
  assert.equal(snapshots.length, 1);
  const snapshot = `${root}/backups/${snapshots[0]}`;
  await command('gzip', ['-t', `${snapshot}/database.sql.gz`]);
  assert.equal(JSON.parse(readFileSync(`${snapshot}/update.json`, 'utf8')).status, 'success');
  assert.equal((await adminLogin()).status, 200);
  assert.equal((await (await call(web, '/api/setup/status')).json()).setupRequired, false);
  console.log('PASS : mise à jour réelle, sauvegarde PostgreSQL, configuration et compte administrateur conservés.');

} catch (error) {
  console.error(`::error::${error.message.replace(/[a-f0-9]{32,}/gi, '[secret masqué]').replace(/\r?\n/g, '%0A')}`);
  // Les sorties du lanceur peuvent contenir des secrets générés : les masquer dans les diagnostics CI.
  console.error(output.replace(/[a-f0-9]{32,}/gi, '[secret masqué]'));
  process.exitCode = 1;
} finally {
  if (updateTemp) rmSync(updateTemp, { recursive: true, force: true });
  bootstrap.kill('SIGTERM');
  spawnSync('systemctl', ['stop', 'xnova-api', 'xnova-web']);
  await new Promise(resolve => smtp.close(resolve));
}
