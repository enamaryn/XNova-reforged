import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { waitForJson } from '../install/runner.mjs';

// Each command has its own process group so an interruption also stops npm’s children.
export function commandRunner(signal) {
  return (program, args, { cwd, env = process.env, input, capture = false } = {}) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Opération interrompue.'));
    const child = spawn(program, args, { cwd, env, detached: true, stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'] });
    let output = '';
    let interrupted = false;
    let timer;
    const interrupt = () => {
      interrupted = true;
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
      timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 2000);
      timer.unref();
    };
    signal?.addEventListener('abort', interrupt, { once: true });
    if (capture) child.stdout.on('data', chunk => { output += chunk; });
    if (input !== undefined) { child.stdin.on('error', () => {}); child.stdin.end(input); }
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', interrupt);
      if (interrupted) reject(new Error('Opération interrompue.'));
      else if (code === 0) resolve(output);
      else reject(new Error(`${program} : code de sortie ${code}`));
    });
  });
}

const units = ['xnova-api', 'xnova-web'];
const envScript = 'set -e; set -a; source .env; set +a; exec "$@"';
const writeScript = 'require("node:fs").writeFileSync(process.argv[1], require("node:fs").readFileSync(0), { mode: 0o600 });';

async function waitForWeb(port, run) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await run('curl', ['--fail', '--silent', '--show-error', '--noproxy', '*', '--max-time', '3', '--output', '/dev/null', `http://127.0.0.1:${port}/fr/login`], { capture: true });
      return;
    } catch {
      if (attempt < 59) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Le service web ne répond pas.');
}

export async function updateInstallation({
  root, run = commandRunner(), cleanupRun = run, check = false,
  log = console.log,
  health = async ({ apiPort, webPort, asUser }) => {
    await Promise.all([
      waitForJson(`http://127.0.0.1:${apiPort}/health/ready`, body => body.status === 'ready'),
      waitForWeb(webPort, asUser),
    ]);
  },
}) {
  root = realpathSync(root);
  let phase = 'vérifications';
  let stopped = false;
  let changed = false;
  let snapshot;
  let previous;
  const originallyActive = [];
  let asUser;
  let persist;
  try {
    let account;
    for (const [index, unit] of units.entries()) {
      const state = (await run('systemctl', ['show', unit, '--property=LoadState', '--value'], { capture: true })).trim();
      if (state !== 'loaded') throw new Error(`Service ${unit} absent ; utiliser l’installateur initial.`);
      const user = (await run('systemctl', ['show', unit, '--property=User', '--value'], { capture: true })).trim();
      if (!user || user === 'root' || !/^[a-z_][a-z0-9_-]*[$]?$/.test(user)) throw new Error('Les services doivent utiliser un compte non privilégié.');
      if (account && account !== user) throw new Error('Les deux services doivent utiliser le même compte.');
      account = user;
      const directory = (await run('systemctl', ['show', unit, '--property=WorkingDirectory', '--value'], { capture: true })).trim();
      if (realpathSync(directory) !== realpathSync(join(root, 'apps', index === 0 ? 'api' : 'web'))) throw new Error(`Le service ${unit} utilise un autre clone.`);
      try { await run('systemctl', ['is-active', '--quiet', unit], { capture: true }); originallyActive.push(unit); } catch { /* Service déjà arrêté. */ }
    }
    const appEnv = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
    asUser = (program, args = [], options = {}) => run('runuser', ['-u', account, '--', program, ...args], { env: appEnv, ...options, cwd: root });
    const configured = (program, args = [], options = {}) => asUser('bash', ['-c', envScript, 'xnova-update', program, ...args], options);
    if (!existsSync(join(root, '.env'))) throw new Error('.env absent : aucune configuration ne sera créée.');
    for (const [program, args] of [
      ['test', ['-r', '.env']], ['test', ['-w', '.']],
      ['node', ['-e', 'const [a,b]=process.versions.node.split(".").map(Number); process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)']],
      ['bash', ['-c', 'command -v git && command -v npm && command -v npx && command -v pg_dump && command -v gzip && command -v curl']],
    ]) await asUser(program, args, { capture: true });
    if ((await asUser('git', ['ls-files', '--', '.env'], { capture: true })).trim()) throw new Error('.env est suivi par Git ; arrêter pour préserver la configuration.');
    if ((await asUser('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { capture: true })).trim() !== 'main') throw new Error('Le clone doit être sur la branche main.');
    if ((await asUser('git', ['status', '--porcelain', '--untracked-files=normal'], { capture: true })).trim()) throw new Error('Le dépôt contient des modifications locales ; les conserver avant de relancer.');
    // Lecture des ports uniquement : les secrets restent dans les processus applicatifs.
    const ports = JSON.parse(await configured('node', ['-e', 'console.log(JSON.stringify({apiPort:process.env.API_PORT||"3001",webPort:process.env.PORT||"3000"}))'], { capture: true }));
    for (const value of Object.values(ports)) if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Port API/web invalide dans .env.');
    const npmVersion = (await asUser('npm', ['--version'], { capture: true })).trim();
    // Même génération npm que l’installateur et la CI, sans remplacer npm système.
    const npm = (args, env = false) => (env ? configured : asUser)('npm', args);
    await asUser('git', ['fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
    previous = (await asUser('git', ['rev-parse', 'HEAD'], { capture: true })).trim();
    const target = (await asUser('git', ['rev-parse', 'refs/remotes/origin/main'], { capture: true })).trim();
    if ((await asUser('git', ['ls-tree', '--name-only', target, '--', '.env', '.xnova-install.json', 'packages/database/.env'], { capture: true })).trim()) throw new Error('La version distante contient une configuration privée suivie par Git.');
    try { await asUser('git', ['merge-base', '--is-ancestor', previous, target], { capture: true }); }
    catch { throw new Error('La branche main diverge de origin/main ; aucun reset automatique.'); }
    log(`Version installée : ${previous.slice(0, 12)} ; disponible : ${target.slice(0, 12)}.`);
    if (check) {
      log('Vérifications réussies ; les services sont inchangés. La commande normale compile aussi si le code est déjà à jour.');
      return { previous, target, changed: false };
    }
    phase = 'sauvegarde';
    await asUser('mkdir', ['-p', 'backups']);
    snapshot = (await asUser('mktemp', ['-d', join(root, 'backups', 'update-XXXXXXXX')], { capture: true })).trim();
    persist = (status, executor = run) => executor('runuser', ['-u', account, '--', 'node', '-e', writeScript, join(snapshot, 'update.json')], { cwd: root, input: JSON.stringify({ previous, target, phase, status }, null, 2) + '\n' });
    await persist('in_progress');
    for (const path of ['.env', '.xnova-install.json', 'packages/database/.env']) {
      if (existsSync(join(root, path))) await asUser('install', ['-m', '600', join(root, path), join(snapshot, path === 'packages/database/.env' ? 'database.env' : path)]);
    }
    log(`Sauvegarde de reprise : ${snapshot}`);
    stopped = true; // Inclut une éventuelle erreur pendant l’arrêt du second service.
    await run('systemctl', ['stop', ...units]);
    const backup = await asUser('bash', ['scripts/backup-db.sh'], { capture: true });
    const archive = backup.match(/^OK: sauvegarde créée et vérifiée : (.+) \([^\n]*\)$/m)?.[1];
    if (!archive) throw new Error('Le script de sauvegarde n’a pas confirmé son archive.');
    await asUser('install', ['-m', '600', archive, join(snapshot, 'database.sql.gz')]);
    await asUser('gzip', ['-t', join(snapshot, 'database.sql.gz')]);
    if ((await asUser('git', ['status', '--porcelain', '--untracked-files=normal'], { capture: true })).trim()) throw new Error('Des modifications locales sont apparues pendant la sauvegarde.');
    phase = 'code';
    changed = true;
    await persist('in_progress');
    // Commit figé au précontrôle, fast-forward uniquement, sans second fetch.
    await asUser('git', ['merge', '--ff-only', target]);
    phase = 'dépendances';
    if (!npmVersion.startsWith('10.')) {
      appEnv.PATH = (await asUser('npx', ['--yes', '--package=npm@10.9.4', 'node', '-e', 'process.stdout.write(process.env.PATH)'], { capture: true })).trim();
      if (!appEnv.PATH || !(await asUser('npm', ['--version'], { capture: true })).trim().startsWith('10.')) throw new Error('La chaîne npm 10 privée est indisponible.');
    }
    await npm(['ci', '--include=dev']);
    phase = 'compilation';
    await configured('npx', ['--no-install', 'prisma', 'generate', '--schema', 'packages/database/prisma/schema.prisma']);
    await configured('bash', ['scripts/verify-install.sh']);
    await npm(['run', 'build'], true);
    phase = 'migrations';
    await configured('npx', ['--no-install', 'prisma', 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma']);
    phase = 'redémarrage';
    await run('systemctl', ['start', ...units]);
    phase = 'vérification des services';
    await health({ ...ports, asUser });
    for (const unit of units) await run('systemctl', ['is-active', '--quiet', unit]);
    phase = 'terminé';
    await persist('success');
    stopped = false;
    log(`Mise à jour réussie (${target.slice(0, 12)}). Sauvegarde conservée : ${snapshot}`);
    return { previous, target, changed: true, snapshot };
  } catch (error) {
    if (stopped) {
      if (!changed) {
        // Échec de sauvegarde : aucune dépendance ni aucun code n’a été remplacé.
        if (originallyActive.length) {
          try { await cleanupRun('systemctl', ['start', ...originallyActive]); }
          catch { log('Impossible de relancer les anciens services ; vérifier systemd.'); }
        }
      } else {
        try { await cleanupRun('systemctl', ['stop', ...units]); } catch { log('Vérifier manuellement l’arrêt des services.'); }
        log('Les services restent arrêtés. Ne pas relancer l’installateur ni réinitialiser la base.');
      }
    }
    if (persist) try { await persist('failed', cleanupRun); } catch { /* Garder l’erreur initiale. */ }
    if (snapshot) log(`Sauvegarde et état de reprise : ${snapshot}`);
    throw new Error(`Mise à jour interrompue pendant « ${phase} » : ${error.message}`, { cause: error });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (process.getuid?.() !== 0 || args.some(arg => arg !== '--check') || args.length > 1) {
    console.error('Utiliser sudo bash scripts/update.sh [--check].');
    process.exitCode = 1;
  } else {
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try { await updateInstallation({ root: resolve(fileURLToPath(new URL('../..', import.meta.url))), check: args.includes('--check'), run: commandRunner(controller.signal), cleanupRun: commandRunner() }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
