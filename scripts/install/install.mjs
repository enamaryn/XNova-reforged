import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { realpathSync, readFileSync } from 'node:fs';
import { createBootstrapServer } from './server.mjs';
import { prepareInstallation, startWeb } from './runner.mjs';

const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
if (process.getuid?.() !== 0) throw new Error('Lancez sudo bash scripts/install.sh sur le serveur.');
const os = readFileSync('/etc/os-release', 'utf8');
if (!/^ID=ubuntu$/m.test(os) || !/^VERSION_ID="?24\.04"?$/m.test(os)) throw new Error('Ubuntu 24.04 est requis.');
const accessCode = randomBytes(32).toString('hex');
const { server } = createBootstrapServer({
  root, accessCode,
  install: (config, code, report) => prepareInstallation(root, config, code, report),
  handoff: async () => {
    try {
      await startWeb(console.log);
      console.log('Installation prête. Terminez le SMTP et le super admin dans votre navigateur.');
      process.exitCode = 0;
    } catch (error) { process.exitCode = 1; throw error; }
  },
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Le port 3000 est occupé. Arrêtez votre ancien service web avant de relancer.' : error.message);
  process.exitCode = 1;
});
server.listen(3000, '127.0.0.1', () => {
  console.log('Assistant web disponible sur le port 3000 local (proxy HTTPS existant ou tunnel SSH).');
  console.log('Code d’accès temporaire (à saisir uniquement dans votre navigateur) :');
  console.log(accessCode);
  console.log('Toutes les questions de configuration sont posées dans la page web.');
});
const expiry = setTimeout(() => server.close(), 2 * 60 * 60 * 1000);
expiry.unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
