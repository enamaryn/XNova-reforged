import { CliDeps, runCli } from './common';
import { formatSetupBanner, isSetupCompleted, issueSetupToken, SetupDb } from '../setup/setup-core';

/**
 * `npm run setup:token` : émet un nouveau code d'installation (l'ancien devient invalide), valable aussitôt pour le
 * parcours web. Refusé si l'installation est terminée (voir `npm run setup:reset`).
 */
export async function run({ db, io }: CliDeps): Promise<number> {
  const setupDb = db as unknown as SetupDb;
  if (await isSetupCompleted(setupDb)) {
    io.err("L'installation du serveur est terminée : le parcours web est verrouillé.");
    io.err('Pour le rejouer depuis le début : npm run setup:reset');
    return 1;
  }
  io.out(formatSetupBanner(await issueSetupToken(setupDb)));
  return 0;
}

if (require.main === module) void runCli((deps) => run(deps));
