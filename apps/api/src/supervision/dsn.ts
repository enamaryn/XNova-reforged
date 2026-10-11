import { randomBytes } from 'crypto';

/** Analyse et validation d'un DSN Sentry. Le DSN n'est jamais journalisé : seuls l'hôte et le projet sont exposés. */
export interface ParsedDsn {
  protocol: 'http' | 'https';
  publicKey: string;
  host: string;
  /** Chemin éventuel avant `/api/<projet>` (Sentry auto-hébergé sous un préfixe). */
  basePath: string;
  projectId: string;
}

const DSN_REGEX = /^(https?):\/\/([A-Za-z0-9]{8,64})(?::[^@/\s]*)?@([A-Za-z0-9.-]+(?::\d{1,5})?)((?:\/[A-Za-z0-9._~-]+)*)\/(\d{1,20})$/;

export function parseDsn(value: string | null | undefined): ParsedDsn | null {
  if (typeof value !== 'string') return null;
  const match = DSN_REGEX.exec(value.trim());
  if (!match) return null;
  return {
    protocol: match[1] as 'http' | 'https',
    publicKey: match[2],
    host: match[3],
    basePath: match[4] ?? '',
    projectId: match[5],
  };
}

export function isValidDsn(value: string | null | undefined): boolean {
  return parseDsn(value) !== null;
}

/** Description non sensible d'un DSN pour l'interface : « hôte / projet », sans la clé. */
export function describeDsn(value: string | null | undefined): string | null {
  const parsed = parseDsn(value);
  return parsed ? `${parsed.host}${parsed.basePath} / ${parsed.projectId}` : null;
}

export type SentryTestResult = {
  ok: boolean;
  /** Code de résultat stable, traduit par l'interface. */
  code: 'accepted' | 'invalid_dsn' | 'rejected_key' | 'project_not_found' | 'rate_limited' | 'server_error' | 'unreachable' | 'timeout';
  httpStatus?: number;
  eventId?: string;
};

/**
 * Envoie un événement de test identifiable (tag `xnova_test`) à l'API d'ingestion Sentry et interprète la
 * réponse HTTP. Aucune dépendance au SDK : le résultat dépend uniquement de la réponse réelle de Sentry.
 * Ne lève jamais d'exception : toute défaillance est un résultat.
 */
export async function sendSentryTestEvent(
  dsn: string,
  environment: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<SentryTestResult> {
  const parsed = parseDsn(dsn);
  if (!parsed) return { ok: false, code: 'invalid_dsn' };

  const eventId = randomBytes(16).toString('hex');
  const now = new Date();
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    level: 'info',
    platform: 'node',
    environment,
    message: 'XNova Reforged — événement de test de la supervision (aucune action requise)',
    tags: { xnova_test: 'true' },
  };
  const body =
    `${JSON.stringify({ event_id: eventId, sent_at: now.toISOString() })}\n` +
    `${JSON.stringify({ type: 'event' })}\n` +
    `${JSON.stringify(event)}\n`;
  const url = `${parsed.protocol}://${parsed.host}${parsed.basePath}/api/${parsed.projectId}/envelope/`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=xnova-supervision/1.0, sentry_key=${parsed.publicKey}`,
      },
      body,
      signal: controller.signal,
    });
    const httpStatus = response.status;
    if (response.ok) return { ok: true, code: 'accepted', httpStatus, eventId };
    if (httpStatus === 401 || httpStatus === 403) return { ok: false, code: 'rejected_key', httpStatus };
    if (httpStatus === 404) return { ok: false, code: 'project_not_found', httpStatus };
    if (httpStatus === 429) return { ok: false, code: 'rate_limited', httpStatus };
    return { ok: false, code: 'server_error', httpStatus };
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return { ok: false, code: name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
