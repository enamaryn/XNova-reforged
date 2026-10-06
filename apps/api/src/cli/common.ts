import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { Writable } from 'stream';

/**
 * Socle des commandes terminal (SETUP-01) : à lancer sur le serveur, avec l'accès à la base que donne le `.env`.
 * Aucune route web n'expose ces opérations : le terminal du serveur fait foi.
 */
export interface CliIo {
  out(message: string): void;
  err(message: string): void;
  ask(question: string, options?: { hidden?: boolean }): Promise<string>;
}

export interface CliDeps {
  db: PrismaClient;
  io: CliIo;
  env: NodeJS.ProcessEnv;
}

export class CliError extends Error {}

/** Charge le `.env` du dépôt (racine du monorepo) sans écraser les variables déjà définies. */
export function loadEnvFile() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../../../.env'),
    resolve(__dirname, '../../../../../.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path });
      return path;
    }
  }
  return null;
}

/** `--cle valeur`, `--cle=valeur`, `--drapeau`. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inline] = arg.slice(2).split('=', 2);
    if (inline !== undefined) flags[rawKey] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[rawKey] = argv[(i += 1)];
    else flags[rawKey] = true;
  }
  return flags;
}

export function createTerminalIo(): CliIo {
  return {
    out: (message) => console.log(message),
    err: (message) => console.error(message),
    ask: (question, options = {}) =>
      new Promise((resolveAnswer) => {
        let muted = false;
        const output = new Writable({
          write(chunk, _encoding, callback) {
            if (!muted) process.stdout.write(chunk);
            callback();
          },
        });
        const rl = createInterface({ input: process.stdin, output, terminal: true });
        rl.question(question, (answer) => {
          rl.close();
          if (options.hidden) process.stdout.write('\n');
          resolveAnswer(answer);
        });
        muted = options.hidden === true; // la question s'affiche, la saisie non
      }),
  };
}

/** Mot de passe : variable d'environnement nommée par `--password-env`, sinon saisie masquée (deux fois). */
export async function readPassword({ db: _db, io, env }: CliDeps, flags: Record<string, string | true>): Promise<string> {
  const envName = flags['password-env'];
  if (typeof envName === 'string') {
    const value = env[envName];
    if (!value) throw new CliError(`La variable d'environnement ${envName} est vide ou absente.`);
    return value;
  }
  const first = await io.ask('Mot de passe : ', { hidden: true });
  const second = await io.ask('Confirmez le mot de passe : ', { hidden: true });
  if (first !== second) throw new CliError('Les deux mots de passe ne correspondent pas.');
  return first;
}

export const PASSWORD_RULE_MESSAGE =
  'Le mot de passe doit contenir de 8 à 100 caractères, avec au moins une minuscule, une majuscule et un chiffre.';

export function assertValidPassword(password: string) {
  if (password.length < 8 || password.length > 100 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new CliError(PASSWORD_RULE_MESSAGE);
  }
}

/** Point d'entrée commun : `main` reçoit les dépendances réelles ; code de sortie 1 en cas d'erreur. */
export async function runCli(main: (deps: CliDeps, argv: string[]) => Promise<number | void>) {
  loadEnvFile();
  const io = createTerminalIo();
  if (!process.env.DATABASE_URL) {
    io.err('DATABASE_URL est absente : lancez la commande depuis le dépôt du serveur (fichier .env à la racine).');
    process.exit(1);
  }
  const db = new PrismaClient({ log: ['error'] });
  try {
    const code = await main({ db, io, env: process.env }, process.argv.slice(2));
    process.exit(typeof code === "number" ? code : 0);
  } catch (error) {
    io.err(error instanceof CliError ? `Erreur : ${error.message}` : `Erreur inattendue : ${(error as Error).message}`);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}
