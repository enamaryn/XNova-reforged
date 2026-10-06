import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Noyau de l'installation du serveur (SETUP-01), partagé par l'API et les commandes terminal.
 * Pur : n'utilise qu'un sous-ensemble minimal du client Prisma (`SetupDb`), donc testable sans base.
 *
 * L'installation est « terminée » quand la clé `setup.completedAt` existe dans `GameConfig`. Tant qu'elle
 * n'existe pas, le parcours web est accessible avec un code d'installation lu dans le terminal du serveur.
 */
export interface SetupDb {
  gameConfig: {
    findUnique(args: { where: { key: string } }): Promise<{ key: string; value: string } | null>;
    findMany(args: { where: { key: { startsWith: string } } }): Promise<Array<{ key: string; value: string }>>;
    upsert(args: {
      where: { key: string };
      create: { key: string; value: string };
      update: { value: string };
    }): Promise<unknown>;
    deleteMany(args: { where: { key: { in: string[] } | { startsWith: string } } }): Promise<unknown>;
  };
}

export const SETUP_KEYS = {
  completedAt: 'setup.completedAt',
  tokenHash: 'setup.tokenHash',
  tokenExpiresAt: 'setup.tokenExpiresAt',
  smtpTestedAt: 'setup.smtpTestedAt',
  settingsSavedAt: 'setup.settingsSavedAt',
  adminId: 'setup.adminId',
} as const;

/** Durée de validité du code, renouvelée à chaque requête valide (inactivité maximale). */
export const SETUP_TOKEN_IDLE_MS = 2 * 60 * 60 * 1000;

// Alphabet sans caractères ambigus (0/O, 1/I/L) : le code se recopie depuis un terminal
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Génère un code `XXXX-XXXX-XXXX-XXXX` (16 caractères sur 31 : environ 79 bits). */
export function generateSetupToken(): string {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

/** Majuscules, sans espaces ni tirets : « abcd efgh » et « ABCD-EFGH » désignent le même code. */
export function normalizeSetupToken(value: string): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const hashToken = (normalized: string) => createHash('sha256').update(normalized).digest('hex');

async function getValue(db: SetupDb, key: string): Promise<string | null> {
  return (await db.gameConfig.findUnique({ where: { key } }))?.value ?? null;
}

async function setValue(db: SetupDb, key: string, value: string) {
  await db.gameConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function isSetupCompleted(db: SetupDb): Promise<boolean> {
  return (await getValue(db, SETUP_KEYS.completedAt)) !== null;
}

/**
 * Émet un nouveau code (l'ancien devient invalide). `fixedToken` (variable `SETUP_TOKEN`) permet
 * l'automatisation et les tests ; sans lui, le code est aléatoire. Retourne le code en clair, à afficher
 * une seule fois : seul son empreinte est stockée.
 */
export async function issueSetupToken(
  db: SetupDb,
  options: { fixedToken?: string; now?: Date } = {},
): Promise<string> {
  const now = options.now ?? new Date();
  const fixed = options.fixedToken?.trim();
  const token = fixed ? fixed : generateSetupToken();
  await setValue(db, SETUP_KEYS.tokenHash, hashToken(normalizeSetupToken(token)));
  await setValue(db, SETUP_KEYS.tokenExpiresAt, new Date(now.getTime() + SETUP_TOKEN_IDLE_MS).toISOString());
  return token;
}

/**
 * Vérifie un code. Refusé si l'installation est terminée, si le code est inconnu ou expiré.
 * Un code valide repousse l'expiration (fenêtre glissante d'inactivité).
 */
export async function verifySetupToken(
  db: SetupDb,
  token: string | undefined,
  now: Date = new Date(),
): Promise<boolean> {
  if (!token) return false;
  if (await isSetupCompleted(db)) return false;

  const [storedHash, expiresAt] = await Promise.all([
    getValue(db, SETUP_KEYS.tokenHash),
    getValue(db, SETUP_KEYS.tokenExpiresAt),
  ]);
  if (!storedHash || !expiresAt) return false;
  if (new Date(expiresAt).getTime() <= now.getTime()) return false;

  const candidate = Buffer.from(hashToken(normalizeSetupToken(token)), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) return false;

  await setValue(db, SETUP_KEYS.tokenExpiresAt, new Date(now.getTime() + SETUP_TOKEN_IDLE_MS).toISOString());
  return true;
}

/** Supprime le code et la progression du parcours (conserve `completedAt`). */
export async function clearSetupArtifacts(db: SetupDb) {
  await db.gameConfig.deleteMany({
    where: {
      key: {
        in: [
          SETUP_KEYS.tokenHash,
          SETUP_KEYS.tokenExpiresAt,
          SETUP_KEYS.smtpTestedAt,
          SETUP_KEYS.settingsSavedAt,
          SETUP_KEYS.adminId,
        ],
      },
    },
  });
}

/** Marque l'installation comme terminée et efface le code : le parcours web n'est plus accessible. */
export async function markSetupCompleted(db: SetupDb, now: Date = new Date()) {
  await setValue(db, SETUP_KEYS.completedAt, now.toISOString());
  await clearSetupArtifacts(db);
}

/**
 * Réarme le parcours (commande terminal uniquement) : efface l'indicateur de fin et la progression, émet un
 * nouveau code. Les comptes et réglages existants ne sont pas supprimés.
 */
export async function resetSetup(
  db: SetupDb,
  options: { fixedToken?: string; now?: Date } = {},
): Promise<string> {
  await db.gameConfig.deleteMany({ where: { key: { in: [SETUP_KEYS.completedAt] } } });
  await clearSetupArtifacts(db);
  return issueSetupToken(db, options);
}

export interface SetupProgressFlags {
  smtpTestedAt: string | null;
  settingsSavedAt: string | null;
  adminId: string | null;
}

export async function readProgressFlags(db: SetupDb): Promise<SetupProgressFlags> {
  const rows = await db.gameConfig.findMany({ where: { key: { startsWith: 'setup.' } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    smtpTestedAt: map.get(SETUP_KEYS.smtpTestedAt) ?? null,
    settingsSavedAt: map.get(SETUP_KEYS.settingsSavedAt) ?? null,
    adminId: map.get(SETUP_KEYS.adminId) ?? null,
  };
}

export async function writeProgressFlag(
  db: SetupDb,
  key: typeof SETUP_KEYS.smtpTestedAt | typeof SETUP_KEYS.settingsSavedAt | typeof SETUP_KEYS.adminId,
  value: string,
) {
  await setValue(db, key, value);
}

export async function clearProgressFlag(db: SetupDb, key: keyof typeof SETUP_KEYS) {
  await db.gameConfig.deleteMany({ where: { key: { in: [SETUP_KEYS[key]] } } });
}

/** Message affiché dans le terminal (journal du service) quand un code est émis. */
export function formatSetupBanner(token: string): string {
  const line = '='.repeat(64);
  return [
    '',
    line,
    '  INSTALLATION DU SERVEUR XNOVA REFORGED',
    line,
    `  Code d'installation : ${token}`,
    '',
    '  Ouvrez /setup dans le navigateur et saisissez ce code pour configurer le serveur',
    '  (SMTP, réglages, compte super admin). Il change à chaque redémarrage de l\'API ;',
    '  en générer un nouveau : npm run setup:token',
    line,
    '',
  ].join('\n');
}
