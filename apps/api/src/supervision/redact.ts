/**
 * Filtrage et masquage centralisés des données avant tout enregistrement d'incident (local ou Sentry).
 * Aucune donnée sensible ne doit sortir d'ici : mots de passe, jetons, cookies, en-têtes d'autorisation,
 * secrets SMTP, DSN privés, clés de chiffrement, contenu des messages privés, adresses email.
 */
export const MASK = '[masqué]';

/** Clés (insensibles à la casse, sur le nom exact ou un fragment) dont la valeur n'est jamais conservée. */
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|jwt|bearer|authorization|cookie|session|credential|api[-_]?key|private|dsn|sentry|encryption|smtp|auth|otp|hash|signature|salt/i;
/** Clés dont la valeur est du contenu privé (messages de joueurs). */
const PRIVATE_CONTENT_KEY = /^(body|content|messages?|text|html|rawBody|payload)$/i;
/** Clés d'adresse email. */
const EMAIL_KEY = /e-?mail|^to$|^from$|recipient/i;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g;
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi;
const DSN_PATTERN = /https?:\/\/[A-Za-z0-9]+(?::[A-Za-z0-9]+)?@[A-Za-z0-9.-]+(?::\d+)?\/\d+/g;
const URL_CREDENTIALS_PATTERN = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const QUERY_SECRET_PATTERN = /([?&](?:token|code|password|key|secret|jwt|access_token|refresh_token)=)[^&\s#]+/gi;
const INLINE_SECRET_PATTERN = /\b(token|password|passwd|pwd|secret|api[_-]?key|access[_-]?key|jwt|dsn)(\s*[=:]\s*)(?!\[masqué\])[^\s,;&"')]+/gi;
const ENC_PATTERN = /\benc:v1:[A-Za-z0-9+/=:]+/g;
const LONG_HEX_PATTERN = /\b[a-f0-9]{48,}\b/gi;
const SETUP_CODE_PATTERN = /\b[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}\b/g;

const MAX_STRING = 2000;
const MAX_DEPTH = 6;
const MAX_KEYS = 50;
const MAX_ARRAY = 20;

/** Masque les motifs sensibles dans une chaîne libre (message, trace, URL). */
export function redactString(input: string, limit = MAX_STRING): string {
  let value = String(input)
    .replace(URL_CREDENTIALS_PATTERN, `$1${MASK}@`)
    .replace(DSN_PATTERN, MASK)
    .replace(JWT_PATTERN, MASK)
    .replace(BEARER_PATTERN, `$1 ${MASK}`)
    .replace(ENC_PATTERN, MASK)
    .replace(INLINE_SECRET_PATTERN, `$1$2${MASK}`)
    .replace(QUERY_SECRET_PATTERN, `$1${MASK}`)
    .replace(EMAIL_PATTERN, MASK)
    .replace(SETUP_CODE_PATTERN, MASK)
    .replace(LONG_HEX_PATTERN, MASK);
  if (value.length > limit) value = `${value.slice(0, limit)}…`;
  return value;
}

/**
 * Copie filtrée d'une valeur quelconque : objets et tableaux parcourus (profondeur et taille bornées),
 * clés sensibles masquées quel que soit leur niveau d'imbrication, chaînes nettoyées. Gère les cycles.
 */
export function redactValue(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack ? redactString(value.stack, 4000) : undefined };
  }
  if (typeof value !== 'object') return undefined;
  if (depth >= MAX_DEPTH) return '[trop profond]';
  if (seen.has(value as object)) return '[cycle]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => redactValue(item, depth + 1, seen));
  }
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (count++ >= MAX_KEYS) {
      out['…'] = 'clés supplémentaires ignorées';
      break;
    }
    if (SENSITIVE_KEY.test(key) || PRIVATE_CONTENT_KEY.test(key) || EMAIL_KEY.test(key)) {
      out[key] = MASK;
    } else {
      out[key] = redactValue(item, depth + 1, seen);
    }
  }
  return out;
}

/** Route sans paramètre de requête ni identifiant variable, pour regrouper les erreurs d'une même route. */
export function normalizeRoute(route: string | undefined | null): string | undefined {
  if (!route) return undefined;
  const path = String(route).split('?')[0].split('#')[0];
  return redactString(
    path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+(?=\/|$)/g, '/:n'),
    200,
  );
}
