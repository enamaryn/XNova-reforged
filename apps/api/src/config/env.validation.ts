/**
 * Validation de l'environnement (SEC-04).
 *
 * En production, l'API refuse de démarrer si un secret ou une origine manque ou garde une valeur
 * d'exemple. Hors production, la validation reste permissive (développement, tests).
 */
const PLACEHOLDER_PATTERN = /^(change[-_ ]?me|changeme|secret|password|test|dev|example)/i;
const MIN_SECRET_LENGTH = 32;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  if (env.NODE_ENV !== 'production') {
    return env;
  }

  const errors: string[] = [];
  const str = (key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = str(key);
    if (!value) {
      errors.push(`${key} est requis en production`);
    } else if (value.length < MIN_SECRET_LENGTH || PLACEHOLDER_PATTERN.test(value)) {
      errors.push(
        `${key} doit contenir au moins ${MIN_SECRET_LENGTH} caractères et ne pas être une valeur d'exemple`,
      );
    }
  }

  if (str('JWT_SECRET') && str('JWT_SECRET') === str('JWT_REFRESH_SECRET')) {
    errors.push('JWT_SECRET et JWT_REFRESH_SECRET doivent être distincts');
  }

  if (!str('DATABASE_URL')) {
    errors.push('DATABASE_URL est requis en production');
  }

  const origins = (str('WEB_ORIGINS') || str('WEB_ORIGIN'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    errors.push('WEB_ORIGINS (ou WEB_ORIGIN) est requis en production : CORS ne peut pas rester ouvert');
  } else if (origins.some((origin) => origin === '*')) {
    errors.push('WEB_ORIGINS ne peut pas contenir « * » en production');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration invalide pour la production :\n- ${errors.join('\n- ')}`);
  }

  return env;
}

/** Origines web autorisées ; `true` (toutes) seulement hors production. */
export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] | true {
  const origins = (env.WEB_ORIGINS || env.WEB_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (env.NODE_ENV === 'production') {
    return origins; // jamais ouvert : liste vide = aucune origine tierce autorisée
  }
  return origins.length > 0 ? origins : true;
}
