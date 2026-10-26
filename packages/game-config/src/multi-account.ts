// Doubles comptes : deux comptes sont « liés » quand ils partagent une adresse email canonique (alias +tag, points
// Gmail…) ou une adresse IP vue récemment. Les liens servent à refuser des inscriptions en trop, à bloquer les échanges
// de ressources entre comptes liés et à alerter les administrateurs ; une exemption manuelle couvre les foyers et
// les écoles. Tous les réglages sont modifiables depuis la console admin.

export interface MultiAccountConfig {
  /** Refuse l'inscription quand l'adresse IP a déjà trop de comptes. */
  enforceRegistration: boolean;
  /** Comptes distincts (hors exemptions) admis par adresse IP sur la fenêtre ; 0 = illimité. */
  maxAccountsPerIp: number;
  /** Fenêtre, en jours, pendant laquelle une IP vue relie deux comptes. */
  ipWindowDays: number;
  /** Interdit l'achat au marché et le transport de ressources entre comptes liés. */
  blockLinkedTransfers: boolean;
  /** Durée de conservation des adresses IP, en jours (purge quotidienne). */
  retentionDays: number;
}

export const MULTI_ACCOUNT_DEFAULTS: MultiAccountConfig = {
  enforceRegistration: true,
  maxAccountsPerIp: 3,
  ipWindowDays: 30,
  blockLinkedTransfers: true,
  retentionDays: 90,
};

export const MULTI_ACCOUNT_CONFIG_KEY = 'multiAccount.config';

export const MULTI_ACCOUNT_LIMITS = {
  maxAccountsPerIp: { min: 0, max: 100 },
  ipWindowDays: { min: 1, max: 365 },
  retentionDays: { min: 1, max: 730 },
} as const;

/** Domaines qui désignent la même boîte. */
const DOMAIN_ALIASES: Record<string, string> = { 'googlemail.com': 'gmail.com' };

/**
 * Forme canonique d'une adresse email : minuscules, partie « +étiquette » retirée, points ignorés chez Gmail,
 * alias de domaine ramenés au domaine principal. Deux adresses de même forme canonique sont la même boîte.
 */
export function canonicalizeEmail(email: string): string {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at < 1) return value;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  domain = DOMAIN_ALIASES[domain] ?? domain;
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

/**
 * Adresse IP normalisée : IPv4 mappée en IPv6 ramenée en IPv4 ; IPv6 réduite à son préfixe /64 (un foyer reçoit
 * un /64 entier, changer les 64 derniers bits ne change pas de foyer). Valeur vide ou illisible : null.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim().toLowerCase();
  if (!ip) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) ip = mapped[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    return ip.split('.').every((part) => Number(part) <= 255) ? ip : null;
  }
  if (!ip.includes(':') || !/^[0-9a-f:]+$/.test(ip)) return null;
  // Développe « :: » pour lire les quatre premiers groupes
  const [head, tail = ''] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = ip.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  if (missing < 0) return null;
  const groups = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  if (groups.length !== 8 || groups.some((g) => g.length < 1 || g.length > 4)) return null;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/** Clé ordonnée d'une paire de comptes (exemptions). */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function strictInt(value: unknown, min: number, max: number, label: string, errors: string[]): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${label} doit être un entier compris entre ${min} et ${max}`);
    return min;
  }
  return value;
}

export type MultiAccountParse = { ok: true; config: MultiAccountConfig } | { ok: false; errors: string[] };

/** Valide un réglage complet envoyé par la console admin (rien n'est corrigé en silence). */
export function parseMultiAccountConfig(input: unknown): MultiAccountParse {
  const errors: string[] = [];
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const limits = MULTI_ACCOUNT_LIMITS;
  for (const key of ['enforceRegistration', 'blockLinkedTransfers'] as const) {
    if (typeof source[key] !== 'boolean') errors.push(`${key} doit être un booléen`);
  }
  const maxAccountsPerIp = strictInt(source.maxAccountsPerIp, limits.maxAccountsPerIp.min, limits.maxAccountsPerIp.max, 'maxAccountsPerIp', errors);
  const ipWindowDays = strictInt(source.ipWindowDays, limits.ipWindowDays.min, limits.ipWindowDays.max, 'ipWindowDays', errors);
  const retentionDays = strictInt(source.retentionDays, limits.retentionDays.min, limits.retentionDays.max, 'retentionDays', errors);
  if (ipWindowDays > retentionDays) errors.push('ipWindowDays ne peut pas dépasser retentionDays');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      enforceRegistration: source.enforceRegistration as boolean,
      maxAccountsPerIp,
      ipWindowDays,
      blockLinkedTransfers: source.blockLinkedTransfers as boolean,
      retentionDays,
    },
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(Math.max(number, min), max);
}

/** Relit un réglage stocké ; valeur absente ou invalide : défaut (un enregistrement corrompu ne bloque rien). */
export function readMultiAccountConfig(raw: string | null | undefined): MultiAccountConfig {
  if (!raw) return MULTI_ACCOUNT_DEFAULTS;
  let stored: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    stored = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return MULTI_ACCOUNT_DEFAULTS;
  }
  const d = MULTI_ACCOUNT_DEFAULTS;
  const l = MULTI_ACCOUNT_LIMITS;
  const retentionDays = clampInt(stored.retentionDays, l.retentionDays.min, l.retentionDays.max, d.retentionDays);
  return {
    enforceRegistration: typeof stored.enforceRegistration === 'boolean' ? stored.enforceRegistration : d.enforceRegistration,
    maxAccountsPerIp: clampInt(stored.maxAccountsPerIp, l.maxAccountsPerIp.min, l.maxAccountsPerIp.max, d.maxAccountsPerIp),
    ipWindowDays: Math.min(clampInt(stored.ipWindowDays, l.ipWindowDays.min, l.ipWindowDays.max, d.ipWindowDays), retentionDays),
    blockLinkedTransfers: typeof stored.blockLinkedTransfers === 'boolean' ? stored.blockLinkedTransfers : d.blockLinkedTransfers,
    retentionDays,
  };
}
