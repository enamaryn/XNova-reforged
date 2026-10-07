import { spawn } from 'node:child_process';
import { readFileSync, realpathSync, existsSync, lstatSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { managedFile, MARKER, renderService, renderProxy } from './config.mjs';

const SERVICE_NAMES = ['xnova-api.service', 'xnova-web.service'];
const SERVICE_DIRECTORIES = ['/etc/systemd/system', '/run/systemd/system'];
function pathExists(path) {
  try { lstatSync(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function findExistingServices(directories = [...SERVICE_DIRECTORIES, '/usr/lib/systemd/system', '/lib/systemd/system']) {
  return SERVICE_NAMES.filter(unit => directories.some(directory =>
    pathExists(join(directory, unit)) || pathExists(join(directory, `${unit}.d`)),
  ));
}

export async function resetServices(run = command, directories = SERVICE_DIRECTORIES) {
  const listed = await run('systemctl', ['list-unit-files', ...SERVICE_NAMES, '--no-legend', '--no-pager'], { capture: true });
  const loaded = await run('systemctl', ['list-units', '--all', '--plain', '--no-legend', '--no-pager', ...SERVICE_NAMES], { capture: true });
  const names = text => new Set(text.trim().split('\n').map(line => line.trim().split(/\s+/)[0]));
  const files = names(listed), active = names(loaded);
  for (const unit of SERVICE_NAMES) {
    if (active.has(unit)) {
      await run('systemctl', ['stop', unit]);
      await run('systemctl', ['reset-failed', unit]);
    }
    if (files.has(unit)) await run('systemctl', ['disable', unit]);
    for (const directory of directories) {
      // Chemins fixes XNova ; unlink/rm retire les liens sans suivre leurs cibles.
      rmSync(join(directory, unit), { force: true });
      rmSync(join(directory, `${unit}.d`), { force: true, recursive: true });
    }
  }
  await run('systemctl', ['daemon-reload']);
}

export function command(program, args, { cwd, env = process.env, input, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env, stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'] });
    let output = '';
    if (capture) child.stdout.on('data', chunk => { output += chunk; });
    if (input !== undefined) {
      child.stdin.on('error', () => {}); // L'erreur de sortie du processus est rapportée ci-dessous.
      child.stdin.end(input);
    }
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`${program} : code de sortie ${code}`)));
  });
}

async function requestJson(url, headers, redirects = 0) {
  const target = new URL(url);
  const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const response = await new Promise((resolve, reject) => {
    const req = request(target, { headers }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
        if (Buffer.byteLength(body) > 65536) req.destroy(new Error('Réponse trop volumineuse.'));
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body }));
    });
    const timer = setTimeout(() => req.destroy(new Error('Délai de vérification dépassé.')), 2000);
    timer.unref();
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
  if (response.status >= 300 && response.status < 400 && response.location && redirects < 5) {
    // Après une redirection HTTPS de Certbot, le Host est celui de la nouvelle URL.
    const nextHeaders = Object.fromEntries(Object.entries(headers || {}).filter(([key]) => key.toLowerCase() !== 'host'));
    return requestJson(new URL(response.location, target), nextHeaders, redirects + 1);
  }
  if (response.status < 200 || response.status >= 300) throw new Error('Réponse HTTP non valide.');
  return JSON.parse(response.body);
}

export async function waitForJson(url, validate, { attempts = 60, delay = 1000, headers } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      // fetch ignore Host : nginx doit recevoir le domaine/IP choisi, pas 127.0.0.1.
      const json = await requestJson(url, headers);
      if (validate(json)) return json;
    } catch { /* Attendre un service qui démarre. */ }
    if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error(`Service non prêt : ${new URL(url).pathname}`);
}

export async function prepareLocalDatabase(config, run = command) {
  const { role, databaseName } = config.state;
  // Noms et mot de passe strictement générés, jamais des fragments SQL saisis dans le navigateur.
  if (!/^xnova_[a-f0-9]{12}$/.test(role) || !/^xnova_(?:prod|dev)_[a-f0-9]{12}$/.test(databaseName)) throw new Error('Identifiants locaux invalides.');
  const url = new URL(config.env.DATABASE_URL);
  if (!/^[a-f0-9]{64}$/.test(url.password)) throw new Error('Mot de passe local invalide.');
  const sql = `SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', '${role}', '${url.password}') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}')\n\\gexec\nSELECT format('CREATE DATABASE %I OWNER %I', '${databaseName}', '${role}') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${databaseName}')\n\\gexec\n`;
  await run('runuser', ['-u', 'postgres', '--', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'], { input: sql });
  // Une reprise ne modifie pas un rôle existant : elle vérifie le mot de passe et la base.
  await run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', role, '-d', databaseName, '-c', 'SELECT 1'], {
    env: { ...process.env, PGPASSWORD: url.password }, capture: true,
  });
}

function preflightFile(path, adopt) {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Configuration système non ordinaire : ${path}`);
  if (!readFileSync(path, 'utf8').startsWith(`${MARKER}\n`) && !adopt) {
    throw new Error('Des services XNova existent déjà. Cochez leur remplacement dans l’assistant pour les reprendre.');
  }
}

export function installService(path, content, adopt) {
  preflightFile(path, adopt);
  if (existsSync(path)) {
    const previous = readFileSync(path);
    if (previous.toString() === content) return;
    if (!previous.toString().startsWith(`${MARKER}\n`)) {
      // Conserver la configuration système précédente avant un remplacement explicitement demandé.
      writeFileSync(`${path}.before-xnova-${Date.now()}`, previous, { flag: 'wx', mode: 0o600 });
    }
    // Les services gérés doivent recevoir les corrections lors d'une reprise.
    // Le bloc nginx reste conservé séparément par managedFile, notamment après Certbot.
    writeFileSync(path, content, { mode: 0o644 });
    return;
  }
  managedFile(path, content);
}

export async function prepareInstallation(root, config, accessCode, report, { run = command } = {}) {
  const { state, env } = config;
  renderService(root, 'api', realpathSync(process.execPath), state); // Valider avant les mutations système.
  const step = async (label, action) => { report(label); await action(); };
  if (state.replaceServices) {
    for (const component of ['api', 'web']) preflightFile(`/etc/systemd/system/xnova-${component}.service`, true);
  } else {
    await step('Suppression des anciens services XNova', () => resetServices(run));
  }
  const packages = ['build-essential', 'python3', 'ca-certificates', 'curl', 'openssl', 'redis-server'];
  if (state.database === 'local') packages.push('postgresql', 'postgresql-client');
  if (state.tls !== 'proxy') packages.push('nginx');
  if (state.tls === 'certbot') packages.push('certbot', 'python3-certbot-nginx');
  await step('Installation des prérequis système', async () => {
    await run('apt-get', ['update']);
    await run('apt-get', ['install', '-y', ...packages], { env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' } });
    const npmVersion = await run('npm', ['--version'], { capture: true });
    if (Number(npmVersion.trim().split('.')[0]) < 10) throw new Error('npm >= 10 est requis.');
  });
  await step('Préparation du compte de service et du cache', async () => {
    await run('bash', ['-c', 'id -u xnova >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/xnova --shell /usr/sbin/nologin xnova']);
    await run('install', ['-d', '-o', 'xnova', '-g', 'xnova', '-m', '700', '/var/cache/xnova']);
    await run('chown', ['-R', 'xnova:xnova', root]);
    await run('chmod', ['600', join(root, '.env'), join(root, '.xnova-install.json')]);
  });
  await step('Démarrage de Redis et de PostgreSQL', async () => {
    await run('systemctl', ['enable', '--now', 'redis-server']);
    if (state.database === 'local') {
      await run('systemctl', ['enable', '--now', 'postgresql']);
      await prepareLocalDatabase(config, run);
    }
  });
  const forwarded = Object.fromEntries([
    'PATH', 'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
  ].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  const appEnv = { ...forwarded, ...env, NPM_CONFIG_CACHE: '/var/cache/xnova/npm' };
  // runuser change l'utilisateur avant toute exécution des scripts de paquets.
  const app = (args, options = {}) => run('runuser', ['-u', 'xnova', '--', ...args], { cwd: root, env: appEnv, ...options });
  await step('Préparation de npm 10 pour l’installation verrouillée', async () => {
    // npm 11 signale à tort les overrides du monorepo comme invalides avec npm ls.
    // Utiliser la même génération que Node 22 / CI, sans remplacer le npm système.
    const version = await app(['npm', '--version'], { capture: true });
    if (Number(version.trim().split('.')[0]) !== 10) {
      await app(['npm', 'install', '--prefix', '/var/cache/xnova/npm-toolchain', '--no-package-lock', '--no-save', 'npm@10.9.4']);
      appEnv.PATH = `/var/cache/xnova/npm-toolchain/node_modules/.bin:${appEnv.PATH}`;
    }
  });
  await step('Installation des dépendances verrouillées', () => app(['npm', 'ci', '--include=dev']));
  await step('Génération Prisma et vérification des dépendances', async () => {
    await app(['npx', '--no-install', 'prisma', 'generate', '--schema', 'packages/database/prisma/schema.prisma']);
    await app(['bash', 'scripts/verify-install.sh']);
  });
  await step('Application des migrations de la base', () => app(['npx', '--no-install', 'prisma', 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma']));
  await step('Compilation de l’application', async () => {
    // Ordre explicite ; aucune configuration publique n'est perdue dans l'environnement Turbo.
    for (const workspace of ['game-config', 'game-engine', 'api', 'web']) {
      await app(['npm', 'run', 'build', `--workspace=@xnova/${workspace}`], workspace === 'web' ? { env: { ...appEnv, NODE_ENV: 'production' } } : {});
    }
  });
  await step('Configuration des services', async () => {
    for (const component of ['api', 'web']) installService(`/etc/systemd/system/xnova-${component}.service`, renderService(root, component, realpathSync(process.execPath), state), state.replaceServices);
    await run('systemctl', ['daemon-reload']);
    await run('systemctl', ['enable', 'xnova-api', 'xnova-web']);
  });
  if (state.tls !== 'proxy') {
    await step('Configuration du proxy web', async () => {
      managedFile('/etc/nginx/conf.d/xnova-bootstrap.conf', renderProxy(state));
      await run('nginx', ['-t']);
      await run('systemctl', ['enable', '--now', 'nginx']);
      await run('systemctl', ['reload', 'nginx']);
      if (state.tls === 'certbot') await run('certbot', ['--nginx', '--non-interactive', '--agree-tos', '--redirect', '--email', state.email, '-d', new URL(state.url).hostname]);
    });
  }
  await step('Démarrage et vérification de l’API', async () => {
    await run('systemctl', ['restart', 'xnova-api']);
    await waitForJson('http://127.0.0.1:3001/health', json => json.status === 'ok' && json.database?.status === 'connected');
  });
  const status = await waitForJson('http://127.0.0.1:3001/setup/status', json => typeof json.setupRequired === 'boolean');
  if (state.tls !== 'proxy') {
    // Le bloc nginx retire réellement /api et atteint l'API, même avant le relais vers Next.
    await waitForJson('http://127.0.0.1/api/setup/status', json => json.setupRequired === status.setupRequired, { headers: { Host: new URL(state.url).hostname } });
  }
  if (status.setupRequired) {
    // Le code initial autorise aussi la suite du parcours, sans le persister en clair dans .env.
    await app([process.execPath, '-e', `const {PrismaClient}=require('@prisma/client'); const {issueSetupToken}=require('./apps/api/dist/setup/setup-core.js'); const db=new PrismaClient(); issueSetupToken(db,{fixedToken:process.env.XNOVA_BOOTSTRAP_CODE}).then(()=>db.$disconnect()).catch(async()=>{await db.$disconnect();process.exit(1)});`], {
      env: { ...appEnv, XNOVA_BOOTSTRAP_CODE: accessCode },
    });
  }
  return { setupRequired: status.setupRequired };
}

export async function startWeb(report, run = command) {
  report('Démarrage du site web');
  await run('systemctl', ['restart', 'xnova-web']);
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch('http://127.0.0.1:3000/fr/setup', { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.text()).includes('Installation du serveur')) return;
    } catch { /* Attendre Next. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Le site web ne répond pas. Consultez journalctl -u xnova-web.');
}
