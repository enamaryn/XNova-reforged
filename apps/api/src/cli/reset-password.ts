import * as argon2 from 'argon2';
import { CliDeps, CliError, assertValidPassword, parseArgs, readPassword, runCli } from './common';

/**
 * `npm run admin:reset-password -- --username NOM [--password-env VARIABLE]`
 *
 * Remplace le mot de passe d'un compte (mot de passe perdu, sans SMTP) : saisie sans écho, toutes les sessions du
 * compte sont révoquées et ses liens de réinitialisation en attente invalidés.
 */
export async function run(deps: CliDeps, argv: string[]): Promise<number> {
  const { db, io } = deps;
  const flags = parseArgs(argv);
  const username = typeof flags.username === 'string' ? flags.username.trim() : '';
  if (!username) throw new CliError('--username est requis.');

  const user = await db.user.findUnique({ where: { username } });
  if (!user) throw new CliError(`Aucun compte « ${username} ».`);

  const password = await readPassword(deps, flags);
  assertValidPassword(password);
  const hash = await argon2.hash(password);

  const now = new Date();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { password: hash } }),
    db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
    db.emailToken.updateMany({ where: { userId: user.id, type: 'reset_password', usedAt: null }, data: { usedAt: now } }),
  ]);
  io.out(`Mot de passe de « ${username} » remplacé ; ses sessions ont été révoquées.`);
  return 0;
}

if (require.main === module) void runCli((deps, argv) => run(deps, argv));
