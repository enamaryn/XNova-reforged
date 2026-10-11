import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { computeFingerprint } from './fingerprint';
import { getBuildInfo } from './build-info';
import { setIncidentSink, type IncidentInput, type IncidentLevel } from './incident-sink';
import { normalizeRoute, redactString, redactValue } from './redact';
import { LOCAL_DEFAULTS, SupervisionConfigService, type LocalSettings } from './supervision-config.service';

interface Pending {
  fingerprint: string;
  level: IncidentLevel;
  source: string;
  message: string;
  errorType: string | null;
  operation: string | null;
  httpStatus: number | null;
  userId: string | null;
  planetId: string | null;
  context: unknown;
  stack: string | null;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  attempts: number;
}

export type ExternalForwarder = (input: { level: IncidentLevel; error?: unknown; message: string; context?: unknown }) => void;

const MAX_PENDING = 200;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
const LEVEL_RANK: Record<IncidentLevel, number> = { warning: 0, error: 1, fatal: 2 };

/** Sortie de dernier recours (jamais le journal NestJS : aucune récursion possible). */
function fallbackLog(entry: Record<string, unknown>) {
  try {
    process.stderr.write(`${JSON.stringify({ supervision: 'incident', ...entry })}\n`);
  } catch {
    /* rien de plus à faire */
  }
}

/**
 * Enregistrement des incidents. Principes :
 * - `record()` est synchrone, en mémoire, et ne lève jamais : la requête métier n'est jamais ralentie ni en échec ;
 * - les incidents identiques sont regroupés par empreinte avant même d'atteindre la base ;
 * - l'écriture se fait par lots (toutes les 2 s) avec un UPSERT atomique (`ON CONFLICT`) : deux erreurs
 *   identiques simultanées incrémentent le même compteur, quelle que soit la concurrence ;
 * - base indisponible : repli sur la sortie standard (journald) ; mémoire et volume bornés.
 */
@Injectable()
export class IncidentService implements OnModuleInit, OnModuleDestroy {
  private buffer = new Map<string, Pending>();
  private timer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private local: LocalSettings = { ...LOCAL_DEFAULTS };
  private flushing = false;
  private lastTrimAt = 0;
  private lastExternalForward: ExternalForwarder | null = null;
  dropped = 0;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: SupervisionConfigService,
  ) {}

  async onModuleInit() {
    setIncidentSink((input) => this.record(input));
    await this.refreshLocal();
    this.refreshTimer = setInterval(() => void this.refreshLocal(), 15_000);
    this.refreshTimer.unref();
    // Observe sans modifier le comportement par défaut de Node (arrêt du processus)
    process.on('uncaughtExceptionMonitor', this.onUncaught);
  }

  async onModuleDestroy() {
    setIncidentSink(null);
    process.off('uncaughtExceptionMonitor', this.onUncaught);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }

  private readonly onUncaught = (error: Error) => {
    fallbackLog({ level: 'fatal', message: redactString(error?.message ?? 'exception non rattrapée'), errorType: error?.name });
    this.record({ level: 'fatal', source: 'system', error, operation: 'uncaughtException' });
  };

  /** Branche l'envoi vers un service externe (Sentry) : appelé pour chaque incident accepté. */
  setExternalForwarder(forward: ExternalForwarder | null) {
    this.lastExternalForward = forward;
  }

  private async refreshLocal() {
    this.local = await this.config.getLocal();
  }

  /** Paramètres locaux courants (copie mémoire rafraîchie toutes les 15 s). */
  getLocalSettings(): LocalSettings {
    return this.local;
  }

  private accepts(level: IncidentLevel): boolean {
    if (level === 'fatal') return true;
    if (level === 'error') return this.local.minLevel === 'error';
    return this.local.warningsEnabled && this.local.minLevel === 'error';
  }

  /** Enregistre un incident. Synchrone, sans exception, sans attente de la base. */
  record(input: IncidentInput): void {
    try {
      if (!this.accepts(input.level)) return;
      // Pendant une écriture en base, ignorer les incidents « database » : évite toute boucle
      if (this.flushing && input.source === 'database') return;

      const error = input.error as { name?: string; message?: string; stack?: string; constructor?: { name?: string } } | undefined;
      const rawMessage = input.message ?? (error && typeof error === 'object' ? error.message : undefined) ?? 'erreur sans message';
      const message = redactString(String(rawMessage), MAX_MESSAGE);
      const stack = error && typeof error.stack === 'string' ? redactString(error.stack, MAX_STACK) : null;
      const errorType =
        input.errorType ?? (error && typeof error === 'object' ? error.name ?? error.constructor?.name : undefined) ?? null;
      const operation = normalizeRoute(input.operation) ?? null;
      const httpStatus = Number.isInteger(input.httpStatus) ? (input.httpStatus as number) : null;

      const fingerprint = computeFingerprint({ source: input.source, level: input.level, errorType, message, operation, httpStatus, stack });
      const count = Math.max(1, Math.min(1000, Math.floor(input.count ?? 1)));
      const now = new Date();

      const existing = this.buffer.get(fingerprint);
      if (existing) {
        existing.count += count;
        existing.lastSeen = now;
        if (LEVEL_RANK[input.level] > LEVEL_RANK[existing.level]) existing.level = input.level;
      } else {
        if (this.buffer.size >= MAX_PENDING) {
          this.dropped += count;
          return;
        }
        this.buffer.set(fingerprint, {
          fingerprint,
          level: input.level,
          source: input.source,
          message,
          errorType,
          operation,
          httpStatus,
          userId: input.userId ? String(input.userId).slice(0, 64) : null,
          planetId: input.planetId ? String(input.planetId).slice(0, 64) : null,
          context: input.context ? redactValue(input.context) : null,
          stack,
          count,
          firstSeen: now,
          lastSeen: now,
          attempts: 0,
        });
      }

      try {
        this.lastExternalForward?.({ level: input.level, error: input.error, message, context: input.context ? redactValue(input.context) : undefined });
      } catch {
        /* Sentry ne doit jamais perturber l'enregistrement local */
      }
      this.schedule();
    } catch (failure) {
      fallbackLog({ level: 'error', message: 'enregistrement de l’incident impossible', reason: String((failure as Error)?.message).slice(0, 200) });
    }
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 2000);
    this.timer.unref();
  }

  /** Écrit les incidents en attente (lot) ; exposé pour les tests et l'arrêt du serveur. */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.size === 0) return;
    this.flushing = true;
    const batch = [...this.buffer.values()];
    this.buffer.clear();
    const build = getBuildInfo();
    try {
      for (const item of batch) {
        try {
          await this.upsert(item, build.version, build.commit);
        } catch (error) {
          this.fallback(item, error);
        }
      }
      await this.trimIfNeeded();
    } finally {
      this.flushing = false;
    }
  }

  private async upsert(item: Pending, version: string, commit: string | null) {
    const id = randomUUID();
    const context = item.context === null ? null : JSON.stringify(item.context);
    await this.database.$executeRaw`
      INSERT INTO "Incident" ("id","fingerprint","level","source","message","errorType","operation","httpStatus","userId","planetId",
                              "firstSeen","lastSeen","occurrences","status","version","commit","context","stack")
      VALUES (${id}, ${item.fingerprint}, ${item.level}, ${item.source}, ${item.message}, ${item.errorType}, ${item.operation},
              ${item.httpStatus}, ${item.userId}, ${item.planetId}, ${item.firstSeen}, ${item.lastSeen}, ${item.count}, 'new',
              ${version}, ${commit}, ${context}::jsonb, ${item.stack})
      ON CONFLICT ("fingerprint") DO UPDATE SET
        "occurrences" = "Incident"."occurrences" + EXCLUDED."occurrences",
        "lastSeen" = GREATEST("Incident"."lastSeen", EXCLUDED."lastSeen"),
        "level" = CASE WHEN EXCLUDED."level" = 'fatal' THEN 'fatal' ELSE "Incident"."level" END,
        "version" = EXCLUDED."version",
        "commit" = EXCLUDED."commit",
        "status" = CASE WHEN "Incident"."status" = 'resolved' THEN 'new' ELSE "Incident"."status" END,
        "resolvedAt" = CASE WHEN "Incident"."status" = 'resolved' THEN NULL ELSE "Incident"."resolvedAt" END,
        "resolvedById" = CASE WHEN "Incident"."status" = 'resolved' THEN NULL ELSE "Incident"."resolvedById" END`;
  }

  /** Base indisponible : sortie standard (journald), puis une nouvelle tentative au prochain lot. */
  private fallback(item: Pending, error: unknown) {
    fallbackLog({
      level: item.level,
      source: item.source,
      message: item.message,
      occurrences: item.count,
      operation: item.operation,
      storage: 'unavailable',
      reason: String((error as Error)?.message ?? error).split('\n')[0].slice(0, 160),
    });
    item.attempts += 1;
    if (item.attempts < 3 && this.buffer.size < MAX_PENDING && !this.buffer.has(item.fingerprint)) {
      this.buffer.set(item.fingerprint, item);
      this.schedule();
    } else {
      this.dropped += item.count;
    }
  }

  /** Borne le nombre d'incidents distincts : supprime d'abord les plus anciens, résolus ou ignorés. */
  private async trimIfNeeded() {
    if (Date.now() - this.lastTrimAt < 60_000) return;
    this.lastTrimAt = Date.now();
    await this.trim(this.local.maxIncidents);
  }

  async trim(max: number): Promise<number> {
    try {
      const total = await this.database.incident.count();
      if (total <= max) return 0;
      const excess = total - max;
      const victims = await this.database.incident.findMany({
        select: { id: true },
        orderBy: [{ status: 'asc' }, { lastSeen: 'asc' }],
        where: { status: { in: ['resolved', 'ignored'] } },
        take: excess,
      });
      let remaining = excess - victims.length;
      const ids = victims.map((row) => row.id);
      if (remaining > 0) {
        const oldest = await this.database.incident.findMany({
          select: { id: true },
          orderBy: { lastSeen: 'asc' },
          where: { id: { notIn: ids } },
          take: remaining,
        });
        ids.push(...oldest.map((row) => row.id));
        remaining = 0;
      }
      const deleted = await this.database.incident.deleteMany({ where: { id: { in: ids } } });
      return deleted.count;
    } catch {
      return 0;
    }
  }
}
