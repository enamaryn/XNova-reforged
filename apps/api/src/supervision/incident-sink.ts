/**
 * Pont statique entre le journal NestJS, le filtre d'exceptions et le service d'incidents (créé plus tard par
 * l'injection de dépendances). Sans service enregistré, les incidents sont ignorés (démarrage, tests unitaires).
 */
export type IncidentLevel = 'warning' | 'error' | 'fatal';
export type IncidentSource = 'api' | 'frontend' | 'websocket' | 'cron' | 'smtp' | 'database' | 'redis' | 'system';
export const INCIDENT_LEVELS: readonly IncidentLevel[] = ['warning', 'error', 'fatal'];
export const INCIDENT_SOURCES: readonly IncidentSource[] = ['api', 'frontend', 'websocket', 'cron', 'smtp', 'database', 'redis', 'system'];
export const INCIDENT_STATUSES = ['new', 'seen', 'resolved', 'ignored'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IncidentInput {
  level: IncidentLevel;
  source: IncidentSource;
  /** Erreur d'origine (trace, type) ; le message est filtré avant enregistrement. */
  error?: unknown;
  message?: string;
  errorType?: string;
  operation?: string;
  httpStatus?: number;
  userId?: string;
  planetId?: string;
  context?: Record<string, unknown>;
  /** Nombre d'occurrences représentées (regroupement côté navigateur). */
  count?: number;
}

type Sink = (input: IncidentInput) => void;
let sink: Sink | null = null;

export function setIncidentSink(next: Sink | null) {
  sink = next;
}

/** Signale un incident sans jamais lever d'exception ni bloquer l'appelant. */
export function reportIncident(input: IncidentInput): void {
  try {
    sink?.(input);
  } catch {
    /* la supervision ne doit jamais perturber le traitement métier */
  }
}
