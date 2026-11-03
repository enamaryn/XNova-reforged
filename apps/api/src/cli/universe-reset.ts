import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import { ABANDONED_USERNAME, GAME_CONSTANTS } from '@xnova/game-config';
import { createStarterPlanetWithRetry } from '../auth/starter-planet';
import { CliDeps, CliError, parseArgs, runCli } from './common';

const execFileAsync = promisify(execFile);

/** Clé de `GameConfig` qui garde la trace de la dernière remise à zéro (date, comptes, sauvegarde). */
export const UNIVERSE_RESET_KEY = 'universe.lastReset';

/** Points d'appui remplaçables par les tests : sauvegarde, détection de l'API, création de la planète de départ. */
export interface UniverseResetHooks {
  /** Sauvegarde vérifiée de la base ; retourne le chemin de l'archive. Lève une erreur en cas d'échec. */
  backup: () => Promise<string>;
  /** Vrai si l'API répond encore (elle doit être arrêtée pendant l'opération). */
  apiIsRunning: (env: NodeJS.ProcessEnv) => Promise<boolean>;
  starterPlanet: typeof createStarterPlanetWithRetry;
}

/** Compteurs affichés avant l'opération (ce qui sera effacé) et après (contrôle). */
const COUNTED_TABLES = [
  ['planet', 'planètes et lunes des joueurs'],
  ['fleet', 'flottes'],
  ['missileStrike', 'frappes de missiles'],
  ['expeditionReport', "rapports d'expédition"],
  ['combatReport', 'rapports de combat'],
  ['spyReport', "rapports d'espionnage"],
  ['message', 'messages privés'],
  ['alliance', 'alliances'],
  ['marketOffer', 'offres du marché'],
  ['marketTrade', 'échanges du marché'],
  ['npcTrade', 'échanges avec le marchand PNJ'],
  ['galacticBoss', 'boss galactiques'],
  ['invasion', 'invasions aliens'],
  ['questClaim', 'quêtes réclamées'],
  ['achievementUnlock', 'succès débloqués'],
  ['officer', 'officiers'],
  ['fleetCommander', 'commandants de flotte'],
  ['technology', 'technologies'],
  ['worldEvent', 'événements du monde'],
  ['debrisField', 'champs de débris'],
] as const;

type CountedTable = (typeof COUNTED_TABLES)[number][0];

async function count(db: Pick<PrismaClient, CountedTable | 'user'>, table: CountedTable): Promise<number> {
  if (table === 'planet') {
    return db.planet.count({ where: { user: { username: { not: ABANDONED_USERNAME } } } });
  }
  return (db[table] as unknown as { count: () => Promise<number> }).count();
}

/** Sauvegarde par `scripts/backup-db.sh` (même script que les mises à jour) ; l'archive créée est lue dans sa sortie. */
export async function backupWithScript(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const root = resolve(__dirname, '../../../../');
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('bash', [resolve(root, 'scripts/backup-db.sh')], { env, maxBuffer: 10 * 1024 * 1024 }));
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr || (error as Error).message;
    throw new CliError(`La sauvegarde a échoué, rien n'a été modifié : ${detail.trim()}`);
  }
  const archive = stdout.match(/^OK: sauvegarde créée et vérifiée : (.+?) \(/m)?.[1];
  if (!archive) throw new CliError("La sauvegarde n'a pas confirmé son archive, rien n'a été modifié.");
  return archive;
}

/** L'API répond-elle sur son port (`PORT`, 3001 par défaut) ? Toute réponse HTTP suffit. */
export async function apiIsRunning(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const port = Number(env.PORT) || 3001;
  try {
    await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_HOOKS: UniverseResetHooks = {
  backup: () => backupWithScript(),
  apiIsRunning,
  starterPlanet: createStarterPlanetWithRetry,
};

/**
 * `npm run universe:reset` : remet les planètes de l'univers à zéro en gardant les comptes (voir docs/REMISE_A_ZERO.md).
 *
 * Effacé : planètes, lunes, flottes, missiles, expéditions, rapports, messages, alliances, marché, échanges PNJ, boss, invasions,
 * quêtes, succès, officiers, commandants, technologies, événements du monde, champs de débris ; points et rangs remis à 0.
 * Gardé : comptes (nom, email, mot de passe, rôle, langue, acceptation des conditions), réglages et état de
 * l'installation, journal d'audit, signalements du support, planètes « abandonnées » du fond de galaxie.
 * Chaque compte reçoit une nouvelle planète de départ ; les sessions sont révoquées.
 *
 * Garde-fous : refuse de tourner si l'API répond ; confirmation `RESET` ; sauvegarde vérifiée AVANT toute modification
 * (aucune option pour s'en passer) ; une seule transaction, contrôlée avant validation ; `--dry-run` ne change rien.
 */
export async function run(
  { db, io, env }: CliDeps,
  argv: string[],
  hooks: UniverseResetHooks = DEFAULT_HOOKS,
): Promise<number> {
  const flags = parseArgs(argv);
  const dryRun = flags['dry-run'] === true;

  if (await hooks.apiIsRunning(env)) {
    io.err("L'API répond encore : arrêtez le jeu avant la remise à zéro (systemctl stop xnova-api xnova-web).");
    return 1;
  }

  const players = await db.user.findMany({
    where: { username: { not: ABANDONED_USERNAME } },
    select: { id: true, username: true },
    orderBy: { createdAt: 'asc' },
  });

  io.out(dryRun ? 'Simulation (rien ne sera modifié) :' : 'Remise à zéro de l\'univers :');
  io.out(`  Comptes conservés : ${players.length} (chacun reçoit une nouvelle planète de départ, sessions révoquées)`);
  io.out('  Données effacées :');
  for (const [table, label] of COUNTED_TABLES) io.out(`    - ${label} : ${await count(db, table)}`);
  io.out('  Conservés : réglages, état de l\'installation, journal d\'audit, signalements du support, fond de galaxie.');

  if (dryRun) return 0;
  if (players.length === 0) {
    io.err('Aucun compte joueur : rien à remettre à zéro.');
    return 1;
  }

  if (flags.yes !== true) {
    const answer = await io.ask('Tapez RESET pour confirmer (une sauvegarde sera faite d\'abord) : ');
    if (answer.trim() !== 'RESET') {
      io.err("Annulé : rien n'a été modifié.");
      return 1;
    }
  }

  io.out('Sauvegarde de la base…');
  const archive = await hooks.backup();
  io.out(`Sauvegarde vérifiée : ${archive}`);

  const planetSize = Number((await db.gameConfig.findUnique({ where: { key: 'planetSize' } }))?.value);
  const fieldsMax = Number.isFinite(planetSize) && planetSize > 0 ? planetSize : GAME_CONSTANTS.INITIAL_FIELDS;
  const ids = players.map((player) => player.id);

  const deleted = await db.$transaction(
    async (tx) => {
      const summary: Record<string, number> = {};
      const track = async (label: string, operation: Promise<{ count: number }>) => {
        summary[label] = (await operation).count;
      };

      // Les flottes d'abord : elles référencent groupes d'attaque et commandants
      await track('flottes', tx.fleet.deleteMany());
      await track('groupes d\'attaque', tx.attackGroup.deleteMany());
      await track('frappes de missiles', tx.missileStrike.deleteMany());
      await track('rapports d\'expédition', tx.expeditionReport.deleteMany());
      await track('rapports de combat', tx.combatReport.deleteMany());
      await track('rapports d\'espionnage', tx.spyReport.deleteMany());
      await track('champs de débris', tx.debrisField.deleteMany());
      await track('messages', tx.message.deleteMany());
      await track('alliances', tx.alliance.deleteMany()); // les membres suivent en cascade
      await track('échanges du marché', tx.marketTrade.deleteMany());
      await track('offres du marché', tx.marketOffer.deleteMany());
      await track('échanges PNJ', tx.npcTrade.deleteMany());
      await track('boss', tx.galacticBoss.deleteMany()); // dégâts et combats en cascade
      await track('invasions', tx.invasion.deleteMany()); // vagues, dégâts et combats en cascade
      await track('quêtes réclamées', tx.questClaim.deleteMany());
      await track('succès', tx.achievementUnlock.deleteMany());
      await track('officiers', tx.officer.deleteMany());
      await track('commandants', tx.fleetCommander.deleteMany());
      await track('recherches en cours', tx.researchQueue.deleteMany({ where: { userId: { in: ids } } }));
      await track('technologies', tx.technology.deleteMany());
      await track('événements du monde', tx.worldEvent.deleteMany());
      // Planètes et lunes des joueurs : files, vaisseaux et défenses suivent en cascade
      await track('planètes', tx.planet.deleteMany({ where: { userId: { in: ids } } }));

      await tx.user.updateMany({ where: { id: { in: ids } }, data: { points: 0, rank: 0 } });
      await track('sessions révoquées', tx.session.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date() } }));

      for (const id of ids) await hooks.starterPlanet(tx, id, fieldsMax);

      // Contrôle avant validation : une seule planète par compte, plus aucune donnée de jeu
      const planets = await tx.planet.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: true });
      if (planets.length !== ids.length || planets.some((row) => row._count !== 1)) {
        throw new CliError('Contrôle échoué : chaque compte doit avoir exactement une planète de départ. Rien n\'a été modifié.');
      }
      for (const [table, label] of COUNTED_TABLES) {
        if (table === 'planet') continue;
        if ((await count(tx as unknown as PrismaClient, table)) !== 0) {
          throw new CliError(`Contrôle échoué : il reste des données (${label}). Rien n'a été modifié.`);
        }
      }

      await tx.gameConfig.upsert({
        where: { key: UNIVERSE_RESET_KEY },
        update: { value: JSON.stringify({ at: new Date().toISOString(), accounts: ids.length, backup: archive }) },
        create: { key: UNIVERSE_RESET_KEY, value: JSON.stringify({ at: new Date().toISOString(), accounts: ids.length, backup: archive }) },
      });
      return summary;
    },
    { timeout: 10 * 60 * 1000, maxWait: 30_000 },
  );

  io.out('Remise à zéro terminée :');
  for (const [label, total] of Object.entries(deleted)) io.out(`  - ${label} : ${total}`);
  io.out(`  - nouvelles planètes de départ : ${ids.length}`);
  io.out(`Sauvegarde d'avant l'opération : ${archive} (à copier hors du serveur et à garder 30 jours).`);
  io.out('Redémarrez le jeu : systemctl start xnova-api xnova-web, puis contrôlez une connexion et /health.');
  return 0;
}

if (require.main === module) void runCli((deps, argv) => run(deps, argv));
