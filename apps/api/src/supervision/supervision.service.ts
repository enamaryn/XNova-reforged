import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HealthService } from './health.service';
import { IncidentQueryService } from './incident-query.service';
import { isValidDsn, sendSentryTestEvent, type SentryTestResult } from './dsn';
import { SentryRuntimeService } from './sentry-runtime.service';
import { UptimeService } from './uptime.service';
import { SupervisionConfigService, type SupervisionUpdate } from './supervision-config.service';

/** Messages d'API pour chaque résultat de test Sentry (l'interface les traduit à partir du code). */
const TEST_MESSAGES: Record<SentryTestResult['code'], string> = {
  accepted: 'Sentry a accepté l’événement de test.',
  invalid_dsn: 'Le format du DSN est invalide.',
  rejected_key: 'Sentry a refusé la clé du DSN.',
  project_not_found: 'Projet Sentry introuvable.',
  rate_limited: 'Sentry limite les envois (trop de requêtes).',
  server_error: 'Sentry a répondu par une erreur serveur.',
  unreachable: 'Sentry est injoignable depuis le serveur.',
  timeout: 'Sentry n’a pas répondu à temps.',
};

/**
 * Orchestration de la supervision : configuration (locale + Sentry optionnel), test Sentry, état général,
 * purge. La supervision locale n'est jamais désactivable ; Sentry ne peut qu'être ajouté ou retiré.
 */
@Injectable()
export class SupervisionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: SupervisionConfigService,
    private readonly sentry: SentryRuntimeService,
    private readonly health: HealthService,
    private readonly query: IncidentQueryService,
    private readonly uptime: UptimeService,
  ) {}

  getConfig() {
    return this.config.getPublic();
  }

  private validate(update: SupervisionUpdate) {
    const s = update.sentry;
    if (s?.dsnApi && !isValidDsn(s.dsnApi)) throw new BadRequestException('Le DSN Sentry de l’API est invalide (format attendu : https://clé@hôte/projet)');
    if (s?.dsnBrowser && !isValidDsn(s.dsnBrowser)) throw new BadRequestException('Le DSN Sentry du navigateur est invalide (format attendu : https://clé@hôte/projet)');
  }

  /** Enregistre la configuration, applique Sentry à chaud ; `actorId` null pendant l'installation (pas de compte). */
  async updateConfig(actorId: string | null, update: SupervisionUpdate) {
    this.validate(update);
    const before = await this.config.getPublic();
    if (update.sentry?.enabled === true) {
      const hasDsn = before.sentry.dsnApiSet || !!update.sentry.dsnApi;
      if (!hasDsn) throw new BadRequestException('Renseignez le DSN Sentry de l’API avant d’activer Sentry');
    }
    const changed = await this.config.update(update);
    await this.sentry.apply();
    if (actorId && changed.length > 0) {
      // Journal d'audit : noms des champs modifiés seulement, jamais une valeur (DSN compris)
      await this.database.adminAuditLog.create({ data: { userId: actorId, action: 'update_supervision', changes: { fields: changed } } });
    }
    return this.config.getPublic();
  }

  async clearSentry(actorId: string) {
    await this.config.clearSentry();
    await this.sentry.apply();
    await this.database.adminAuditLog.create({ data: { userId: actorId, action: 'clear_sentry', changes: { fields: ['sentry'] } } });
    return this.config.getPublic();
  }

  /** Test Sentry : ne bloque et n'échoue jamais ; le résultat et la date sont conservés localement. */
  async testSentry(actorId: string | null, candidateDsn?: string) {
    const effective = await this.config.getEffectiveSentry();
    const stored = (await this.config.getPublic()).sentry;
    const dsn = candidateDsn?.trim() || effective.dsnApi || null;
    let result: SentryTestResult;
    if (!dsn || !isValidDsn(dsn)) {
      result = { ok: false, code: 'invalid_dsn' };
    } else {
      result = await sendSentryTestEvent(dsn, effective.environment || stored.environment || 'production');
    }
    const lastTest = await this.config.saveLastTest(result).catch(() => null);
    if (actorId) {
      await this.database.adminAuditLog
        .create({ data: { userId: actorId, action: 'test_sentry', changes: { ok: result.ok, code: result.code } } })
        .catch(() => undefined);
    }
    return { ok: result.ok, code: result.code, httpStatus: result.httpStatus ?? null, message: TEST_MESSAGES[result.code], lastTest };
  }

  async setIncidentStatus(id: string, status: 'new' | 'seen' | 'resolved' | 'ignored', actorId: string) {
    const updated = await this.query.setStatus(id, status, actorId);
    await this.database.adminAuditLog.create({ data: { userId: actorId, action: 'incident_status', changes: { incidentId: id, status } } });
    return updated;
  }

  async purge(actorId: string, olderThanDays: number, onlyClosed: boolean) {
    const deleted = await this.query.purge(olderThanDays, onlyClosed);
    await this.database.adminAuditLog.create({ data: { userId: actorId, action: 'purge_incidents', changes: { olderThanDays, onlyClosed, deleted } } });
    return { deleted };
  }

  /** Vue d'ensemble : santé, statistiques des incidents, configuration (sans secret). */
  async overview() {
    const [health, stats, config, uptime] = await Promise.all([
      this.health.checkAll(),
      this.query.stats().catch(() => null),
      this.config.getPublic(),
      this.uptime.summary().catch(() => null),
    ]);
    return { health, stats, config, uptime, localActive: true };
  }
}
