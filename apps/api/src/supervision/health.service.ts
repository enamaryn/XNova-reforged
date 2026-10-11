import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { statfs } from 'fs/promises';
import { cpus, freemem, loadavg, totalmem } from 'os';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { SmtpConfigService } from '../mail/smtp-config.service';
import { SMTP_LAST_TEST_KEY } from './smtp-test-record';
import { RedisService } from '../redis/redis.service';
import { getBuildInfo, lastBackup, repoRoot } from './build-info';
import { cronRegistry } from './cron-registry';

export type CheckStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface HealthCheck {
  id: string;
  status: CheckStatus;
  /** Durée du contrôle en millisecondes. */
  durationMs: number;
  /** Code de message stable (traduit par l'interface) ; `message` en est la version française. */
  code: string;
  message: string;
  checkedAt: string;
  /** Détails non sensibles (compteurs, pourcentages) ; jamais de secret. */
  details: Record<string, string | number | boolean | null>;
}

export type OverallStatus = 'healthy' | 'degraded' | 'unavailable';

export const CHECK_TIMEOUT_MS = 2500;
/** Contrôles dont la panne rend le serveur indisponible (le jeu ne peut pas fonctionner sans eux). */
const CRITICAL = new Set(['database', 'api']);

type CheckResult = Pick<HealthCheck, 'status' | 'code' | 'message'> & { details?: HealthCheck['details'] };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Agrégateur de santé locale. Chaque contrôle est indépendant, borné par un délai court et exécuté en
 * parallèle : un service lent ou en panne donne un résultat dégradé sans jamais bloquer les autres.
 * Aucune commande shell : uniquement des appels de bibliothèques (Prisma, Redis, fs, os, fetch).
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly gateway: GameEventsGateway,
    private readonly smtp: SmtpConfigService,
    private readonly config: ConfigService,
  ) {}

  private async run(id: string, fn: () => Promise<CheckResult>, timeoutMs = CHECK_TIMEOUT_MS): Promise<HealthCheck> {
    const started = Date.now();
    let result: CheckResult;
    try {
      result = await withTimeout(fn(), timeoutMs);
    } catch (error) {
      const timedOut = (error as Error)?.message === 'timeout';
      result = {
        status: 'down',
        code: timedOut ? 'timeout' : 'error',
        message: timedOut ? `Aucune réponse en ${timeoutMs} ms` : 'Contrôle en échec',
        details: timedOut ? { timeoutMs } : {},
      };
    }
    return { id, durationMs: Date.now() - started, checkedAt: new Date().toISOString(), details: {}, ...result };
  }

  async checkAll(): Promise<{ status: OverallStatus; checkedAt: string; checks: HealthCheck[] }> {
    const checks = await Promise.all([
      this.run('database', () => this.checkDatabase()),
      this.run('redis', () => this.checkRedis()),
      this.run('api', () => this.checkApi()),
      this.run('frontend', () => this.checkFrontend()),
      this.run('websocket', () => this.checkWebsocket()),
      this.run('smtp', () => this.checkSmtp()),
      this.run('disk', () => this.checkDisk()),
      this.run('system', () => this.checkSystem()),
      this.run('cron', () => this.checkCron()),
      this.run('queues', () => this.checkQueues()),
      this.run('version', () => this.checkVersion()),
    ]);
    return { status: this.overall(checks), checkedAt: new Date().toISOString(), checks };
  }

  overall(checks: HealthCheck[]): OverallStatus {
    if (checks.some((check) => CRITICAL.has(check.id) && check.status === 'down')) return 'unavailable';
    if (checks.some((check) => check.status === 'down' || check.status === 'degraded')) return 'degraded';
    return 'healthy';
  }

  private async checkDatabase(): Promise<CheckResult> {
    const started = Date.now();
    await this.database.$queryRaw`SELECT 1`;
    const latency = Date.now() - started;
    return latency > 500
      ? { status: 'degraded', code: 'slow', message: `PostgreSQL lent (${latency} ms)`, details: { latencyMs: latency } }
      : { status: 'ok', code: 'ok', message: 'PostgreSQL répond', details: { latencyMs: latency } };
  }

  private async checkRedis(): Promise<CheckResult> {
    const state = await this.redis.ping();
    if (state === 'up') return { status: 'ok', code: 'ok', message: 'Redis répond' };
    if (state === 'disabled') return { status: 'degraded', code: 'disabled', message: 'Redis non configuré (cache désactivé)' };
    return { status: 'degraded', code: 'down', message: 'Redis injoignable (le jeu continue sans cache)' };
  }

  /** Boucle événementielle : retard d'une macro-tâche, mémoire et durée de fonctionnement. */
  private async checkApi(): Promise<CheckResult> {
    const lag = await new Promise<number>((resolve) => {
      const start = Date.now();
      setImmediate(() => resolve(Date.now() - start));
    });
    const memory = process.memoryUsage();
    const details = {
      eventLoopLagMs: lag,
      rssMb: Math.round(memory.rss / 1048576),
      heapUsedMb: Math.round(memory.heapUsed / 1048576),
      uptimeSeconds: Math.round(process.uptime()),
    };
    if (lag > 1000) return { status: 'down', code: 'event_loop_blocked', message: `Boucle événementielle bloquée (${lag} ms)`, details };
    if (lag > 200) return { status: 'degraded', code: 'event_loop_slow', message: `Boucle événementielle lente (${lag} ms)`, details };
    return { status: 'ok', code: 'ok', message: 'API en fonctionnement', details };
  }

  /** Adresse du site web : premier élément de WEB_ORIGINS (configuration, jamais une entrée utilisateur). */
  private webUrl(): string | null {
    const origins = (this.config.get<string>('WEB_INTERNAL_URL') || this.config.get<string>('WEB_ORIGINS') || this.config.get<string>('WEB_ORIGIN') || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => /^https?:\/\//.test(origin));
    if (origins[0]) return origins[0];
    return process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000';
  }

  private async checkFrontend(): Promise<CheckResult> {
    const url = this.webUrl();
    if (!url) return { status: 'unknown', code: 'not_configured', message: 'Adresse du site web non configurée' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS - 300);
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
      return response.status < 500
        ? { status: 'ok', code: 'ok', message: 'Site web joignable', details: { httpStatus: response.status } }
        : { status: 'down', code: 'http_error', message: `Site web en erreur (${response.status})`, details: { httpStatus: response.status } };
    } catch {
      return { status: 'down', code: 'unreachable', message: 'Site web injoignable' };
    } finally {
      clearTimeout(timer);
    }
  }

  private async checkWebsocket(): Promise<CheckResult> {
    const stats = this.gateway.getStats();
    return stats.ready
      ? { status: 'ok', code: 'ok', message: 'WebSocket prêt', details: { connections: stats.connections } }
      : { status: 'down', code: 'not_ready', message: 'WebSocket non initialisé', details: { connections: 0 } };
  }

  /** Configuration SMTP et dernier test enregistré : aucun email n'est envoyé par ce contrôle. */
  private async checkSmtp(): Promise<CheckResult> {
    const settings = await this.smtp.getPublic();
    const configured = settings.enabled && !!settings.host && !!settings.fromEmail;
    if (!configured) return { status: 'degraded', code: 'not_configured', message: 'Envoi d’emails non configuré', details: { configured: false } };
    const row = await this.database.gameConfig.findUnique({ where: { key: SMTP_LAST_TEST_KEY } });
    let last: { at: string; ok: boolean } | null = null;
    try {
      last = row ? (JSON.parse(row.value) as { at: string; ok: boolean }) : null;
    } catch {
      last = null;
    }
    const details = { configured: true, lastTestAt: last?.at ?? null, lastTestOk: last?.ok ?? null };
    if (!last) return { status: 'degraded', code: 'never_tested', message: 'SMTP configuré, jamais testé', details };
    return last.ok
      ? { status: 'ok', code: 'ok', message: 'SMTP configuré, dernier test réussi', details }
      : { status: 'degraded', code: 'last_test_failed', message: 'Le dernier test SMTP a échoué', details };
  }

  private async checkDisk(): Promise<CheckResult> {
    const stats = await statfs(repoRoot());
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const freePercent = total > 0 ? Math.round((free / total) * 1000) / 10 : 0;
    const details = { freeGb: Math.round((free / 1073741824) * 10) / 10, totalGb: Math.round((total / 1073741824) * 10) / 10, freePercent };
    if (freePercent < 3) return { status: 'down', code: 'critical', message: `Espace disque critique (${freePercent} % libre)`, details };
    if (freePercent < 10) return { status: 'degraded', code: 'low', message: `Espace disque faible (${freePercent} % libre)`, details };
    return { status: 'ok', code: 'ok', message: `${freePercent} % d’espace libre`, details };
  }

  private async checkSystem(): Promise<CheckResult> {
    const cores = Math.max(1, cpus().length);
    const [load1] = loadavg();
    const memFreePercent = Math.round((freemem() / totalmem()) * 1000) / 10;
    const loadRatio = Math.round((load1 / cores) * 100) / 100;
    const details = { load1: Math.round(load1 * 100) / 100, cores, loadPerCore: loadRatio, memoryFreePercent: memFreePercent };
    if (loadRatio > 2 || memFreePercent < 5) return { status: 'degraded', code: 'overloaded', message: 'Serveur chargé', details };
    return { status: 'ok', code: 'ok', message: 'Charge et mémoire normales', details };
  }

  /** Tâche planifiée bloquée : aucun battement depuis plus de 3 intervalles (au moins 2 minutes). */
  private async checkCron(): Promise<CheckResult> {
    const now = Date.now();
    const beats = cronRegistry.snapshot();
    const stuck = beats.filter((beat) => now - beat.lastRunAt > Math.max(120_000, beat.intervalMs * 3));
    const failing = beats.filter((beat) => beat.lastError);
    const details = { tasks: beats.length, stuck: stuck.length, failing: failing.length, stuckNames: stuck.map((beat) => beat.name).join(',') || null };
    if (beats.length === 0) return { status: 'unknown', code: 'none', message: 'Aucune tâche planifiée enregistrée', details };
    if (stuck.length) return { status: 'down', code: 'stuck', message: `${stuck.length} tâche(s) planifiée(s) bloquée(s)`, details };
    if (failing.length) return { status: 'degraded', code: 'failing', message: `${failing.length} tâche(s) en erreur à la dernière exécution`, details };
    return { status: 'ok', code: 'ok', message: `${beats.length} tâches planifiées actives`, details };
  }

  /** Files de construction, recherche, chantier et flottes : éléments échus depuis trop longtemps. */
  private async checkQueues(): Promise<CheckResult> {
    const late = (seconds: number) => new Date(Date.now() - seconds * 1000);
    const warn = late(120);
    const crit = late(600);
    const [build, research, ship, fleet, buildCrit, researchCrit, shipCrit, fleetCrit] = await Promise.all([
      this.database.buildQueue.count({ where: { completed: false, endTime: { lt: warn } } }),
      this.database.researchQueue.count({ where: { completed: false, endTime: { lt: warn } } }),
      this.database.shipQueue.count({ where: { completed: false, endTime: { lt: warn } } }),
      this.database.fleet.count({ where: { status: 'traveling', arrivalTime: { lt: warn } } }),
      this.database.buildQueue.count({ where: { completed: false, endTime: { lt: crit } } }),
      this.database.researchQueue.count({ where: { completed: false, endTime: { lt: crit } } }),
      this.database.shipQueue.count({ where: { completed: false, endTime: { lt: crit } } }),
      this.database.fleet.count({ where: { status: 'traveling', arrivalTime: { lt: crit } } }),
    ]);
    const details = { buildingsLate: build, researchLate: research, shipyardLate: ship, fleetsLate: fleet };
    const total = build + research + ship + fleet;
    const critical = buildCrit + researchCrit + shipCrit + fleetCrit;
    if (critical > 0) return { status: 'down', code: 'stalled', message: `${critical} élément(s) en retard de plus de 10 minutes`, details };
    if (total > 0) return { status: 'degraded', code: 'late', message: `${total} élément(s) en retard de plus de 2 minutes`, details };
    return { status: 'ok', code: 'ok', message: 'Files à jour', details };
  }

  private async checkVersion(): Promise<CheckResult> {
    const info = getBuildInfo();
    const backup = lastBackup();
    return {
      status: 'ok',
      code: backup ? 'ok' : 'no_backup',
      message: `Version ${info.version}${info.commit ? ` (${info.commit})` : ''}`,
      details: { version: info.version, commit: info.commit, startedAt: info.startedAt, lastBackupAt: backup?.at ?? null, lastBackupName: backup?.name ?? null },
    };
  }
}
