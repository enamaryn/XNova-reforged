import * as argon2 from 'argon2';
import { GAME_CONSTANTS } from '@xnova/game-config';
import { createStarterPlanetWithRetry } from '../auth/starter-planet';
import { CliDeps, CliError, assertValidPassword, parseArgs, readPassword, runCli } from './common';

/**
 * `npm run setup:create-admin -- --username NOM --email ADRESSE [--password-env VARIABLE]`
 *
 * Sortie de secours : crée (ou promeut, si l'identifiant existe déjà) un super admin dont l'adresse est déclarée
 * confirmée, sans passer par le web ni l'email. Utile si le SMTP est inaccessible ou si plus aucun super admin
 * ne peut se connecter. Le mot de passe est saisi sans écho (ou lu dans la variable nommée par --password-env).
 */
export async function run(deps: CliDeps, argv: string[]): Promise<number> {
  const { db, io } = deps;
  const flags = parseArgs(argv);
  const username = typeof flags.username === 'string' ? flags.username.trim() : '';
  const email = typeof flags.email === 'string' ? flags.email.trim() : '';

  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    throw new CliError("--username est requis (3 à 20 caractères : lettres, chiffres, tirets et soulignés).");
  }
  const existing = await db.user.findUnique({ where: { username } });

  if (!existing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CliError("--email est requis pour créer un nouveau compte.");
  }

  const password = await readPassword(deps, flags);
  assertValidPassword(password);
  const hash = await argon2.hash(password);

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: 'SUPER_ADMIN', password: hash, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
    });
    await db.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    io.out(`Le compte « ${username} » existe : promu super admin, mot de passe remplacé, sessions révoquées.`);
    return 0;
  }

  const emailTaken = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (emailTaken) throw new CliError(`L'adresse ${email} est déjà utilisée par le compte « ${emailTaken.username} ».`);

  const planetSize = Number((await db.gameConfig.findUnique({ where: { key: 'planetSize' } }))?.value);
  const fieldsMax = Number.isFinite(planetSize) && planetSize > 0 ? planetSize : GAME_CONSTANTS.INITIAL_FIELDS;

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, email, password: hash, role: 'SUPER_ADMIN', emailVerifiedAt: new Date(), points: 0, rank: 0 },
    });
    await createStarterPlanetWithRetry(tx, user.id, fieldsMax);
  });
  io.out(`Super admin « ${username} » créé (adresse ${email} déclarée confirmée). Vous pouvez vous connecter.`);
  return 0;
}

if (require.main === module) void runCli((deps, argv) => run(deps, argv));
