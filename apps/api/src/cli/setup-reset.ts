import { CliDeps, parseArgs, runCli } from './common';
import { formatSetupBanner, resetSetup, SetupDb } from '../setup/setup-core';

/**
 * `npm run setup:reset` : réarme le parcours d'installation (seule façon de le rouvrir). Les comptes, réglages et
 * le SMTP existants sont conservés ; les inscriptions sont fermées jusqu'à la fin du parcours.
 */
export async function run({ db, io }: CliDeps, argv: string[]): Promise<number> {
  const flags = parseArgs(argv);
  io.out('Réarmement du parcours d\'installation :');
  io.out('  - les inscriptions seront fermées jusqu\'à la fin du parcours ;');
  io.out('  - un nouveau code d\'installation sera affiché ;');
  io.out('  - les comptes, réglages et le SMTP actuels sont conservés.');

  if (flags.yes !== true) {
    const answer = await io.ask('Tapez RESET pour confirmer : ');
    if (answer.trim() !== 'RESET') {
      io.err('Annulé : rien n\'a été modifié.');
      return 1;
    }
  }
  io.out(formatSetupBanner(await resetSetup(db as unknown as SetupDb)));
  return 0;
}

if (require.main === module) void runCli((deps, argv) => run(deps, argv));
