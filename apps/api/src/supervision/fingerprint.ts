import { createHash } from 'crypto';

/** Retire les parties variables d'un message (nombres, identifiants) pour regrouper les erreurs identiques. */
export function stableMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b\d{2,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Première ligne « at … » d'une trace : repère le lieu de l'erreur sans les numéros de colonne instables. */
export function stackSite(stack: string | undefined | null): string {
  if (!stack) return '';
  const line = stack.split('\n').find((entry) => /^\s*at\s/.test(entry));
  return line ? line.trim().replace(/:\d+:\d+\)?$/, '') : '';
}

export interface FingerprintInput {
  source: string;
  level: string;
  errorType?: string | null;
  message: string;
  operation?: string | null;
  httpStatus?: number | null;
  stack?: string | null;
}

/**
 * Empreinte stable (SHA-256 tronqué) : même origine, même type, même message nettoyé, même route et même lieu
 * d'erreur donnent la même empreinte, quels que soient l'utilisateur, l'heure ou les identifiants.
 */
export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    input.source,
    input.level,
    input.errorType ?? '',
    stableMessage(input.message),
    input.operation ?? '',
    input.httpStatus ?? '',
    stackSite(input.stack),
  ];
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32);
}
