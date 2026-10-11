import { Injectable } from '@nestjs/common';
import { decryptSecret, encryptSecret } from '../common/security/secret-box';
import { DatabaseService } from '../database/database.service';
import { describeDsn, isValidDsn, type SentryTestResult } from './dsn';

/** Paramètres de la supervision locale : toujours active, seuls la rétention et les seuils se règlent. */
export interface LocalSettings {
  retentionDays: number;
  maxIncidents: number;
  /** Niveau minimal enregistré : `error` (défaut) ou `fatal`. */
  minLevel: 'error' | 'fatal';
  /** Enregistre aussi les avertissements. */
  warningsEnabled: boolean;
  autoPurge: boolean;
}

export const LOCAL_DEFAULTS: LocalSettings = {
  retentionDays: 30,
  maxIncidents: 5000,
  minLevel: 'error',
  warningsEnabled: false,
  autoPurge: true,
};

export const LOCAL_LIMITS = {
  retentionDays: { min: 1, max: 365 },
  maxIncidents: { min: 100, max: 50_000 },
} as const;

export const SENTRY_SAMPLE_RATE_MAX = 0.5;
export const SENTRY_SAMPLE_RATE_DEFAULT = 0.1;

export interface SentryStored {
  enabled: boolean;
  dsnApi: string | null;
  dsnBrowser: string | null;
  environment: string;
  sampleRate: number;
}

export interface SentryLastTest {
  at: string;
  ok: boolean;
  code: SentryTestResult['code'];
  httpStatus?: number;
}

/** Configuration effective de Sentry : variable d'environnement > configuration chiffrée > désactivé. */
export interface SentryEffective {
  active: boolean;
  source: 'environment' | 'stored' | 'none';
  dsnApi: string | null;
  dsnBrowser: string | null;
  environment: string;
  sampleRate: number;
}

/** Vue pour l'interface : jamais un DSN, seulement des indications non sensibles. */
export interface SupervisionPublicConfig {
  local: LocalSettings & { alwaysActive: true };
  sentry: {
    enabled: boolean;
    active: boolean;
    source: 'environment' | 'stored' | 'none';
    dsnApiSet: boolean;
    dsnApiUnreadable: boolean;
    dsnApiHint: string | null;
    dsnBrowserSet: boolean;
    dsnBrowserHint: string | null;
    environment: string;
    sampleRate: number;
    sampleRateMax: number;
    lastTest: SentryLastTest | null;
  };
}

export interface SupervisionUpdate {
  local?: Partial<LocalSettings>;
  sentry?: {
    enabled?: boolean;
    /** Absent : conservé. Chaîne non vide : remplacé. */
    dsnApi?: string;
    dsnBrowser?: string;
    clearDsnApi?: boolean;
    clearDsnBrowser?: boolean;
    environment?: string;
    sampleRate?: number;
  };
}

const K = {
  retentionDays: 'monitoring.local.retentionDays',
  maxIncidents: 'monitoring.local.maxIncidents',
  minLevel: 'monitoring.local.minLevel',
  warningsEnabled: 'monitoring.local.warningsEnabled',
  autoPurge: 'monitoring.local.autoPurge',
  sentryEnabled: 'monitoring.sentry.enabled',
  dsnApi: 'monitoring.sentry.dsnApi',
  dsnBrowser: 'monitoring.sentry.dsnBrowser',
  sentryEnv: 'monitoring.sentry.environment',
  sampleRate: 'monitoring.sentry.sampleRate',
  lastTest: 'monitoring.sentry.lastTest',
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

@Injectable()
export class SupervisionConfigService {
  private cache: { at: number; rows: Map<string, string> } | null = null;
  private readonly ttlMs = 15_000;

  constructor(private readonly database: DatabaseService) {}

  private async rows(force = false): Promise<Map<string, string>> {
    if (!force && this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.rows;
    const found = await this.database.gameConfig.findMany({ where: { key: { startsWith: 'monitoring.' } } });
    const rows = new Map(found.map((row) => [row.key, row.value]));
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  invalidate() {
    this.cache = null;
  }

  private parseLocal(rows: Map<string, string>): LocalSettings {
    const num = (key: string, fallback: number, min: number, max: number) => {
      const parsed = Number(rows.get(key));
      return Number.isFinite(parsed) && rows.has(key) ? clamp(Math.round(parsed), min, max) : fallback;
    };
    return {
      retentionDays: num(K.retentionDays, LOCAL_DEFAULTS.retentionDays, LOCAL_LIMITS.retentionDays.min, LOCAL_LIMITS.retentionDays.max),
      maxIncidents: num(K.maxIncidents, LOCAL_DEFAULTS.maxIncidents, LOCAL_LIMITS.maxIncidents.min, LOCAL_LIMITS.maxIncidents.max),
      minLevel: rows.get(K.minLevel) === 'fatal' ? 'fatal' : 'error',
      warningsEnabled: rows.get(K.warningsEnabled) === 'true',
      autoPurge: rows.has(K.autoPurge) ? rows.get(K.autoPurge) === 'true' : LOCAL_DEFAULTS.autoPurge,
    };
  }

  /** Paramètres locaux ; ne lève jamais (valeurs par défaut sûres si la base est indisponible). */
  async getLocal(): Promise<LocalSettings> {
    try {
      return this.parseLocal(await this.rows());
    } catch {
      return { ...LOCAL_DEFAULTS };
    }
  }

  private parseSentry(rows: Map<string, string>): SentryStored & { dsnApiUnreadable: boolean } {
    const storedApi = rows.get(K.dsnApi);
    const storedBrowser = rows.get(K.dsnBrowser);
    const rate = Number(rows.get(K.sampleRate));
    const dsnApi = decryptSecret(storedApi);
    return {
      enabled: rows.get(K.sentryEnabled) === 'true',
      dsnApi,
      dsnBrowser: decryptSecret(storedBrowser),
      dsnApiUnreadable: !!storedApi && dsnApi === null,
      environment: rows.get(K.sentryEnv) || 'production',
      sampleRate: Number.isFinite(rate) && rows.has(K.sampleRate) ? clamp(rate, 0, SENTRY_SAMPLE_RATE_MAX) : SENTRY_SAMPLE_RATE_DEFAULT,
    };
  }

  /** Configuration effective : la variable d'environnement prime sur la configuration enregistrée. */
  async getEffectiveSentry(): Promise<SentryEffective> {
    const envDsn = process.env.SENTRY_DSN?.trim();
    const envBrowser = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
    const envName = process.env.SENTRY_ENV?.trim() || process.env.NEXT_PUBLIC_SENTRY_ENV?.trim();
    let stored: SentryStored | null = null;
    try {
      stored = this.parseSentry(await this.rows());
    } catch {
      stored = null;
    }
    if (envDsn && isValidDsn(envDsn)) {
      return {
        active: true,
        source: 'environment',
        dsnApi: envDsn,
        dsnBrowser: envBrowser && isValidDsn(envBrowser) ? envBrowser : stored?.dsnBrowser ?? null,
        environment: envName || stored?.environment || process.env.NODE_ENV || 'production',
        sampleRate: stored?.sampleRate ?? (process.env.NODE_ENV === 'production' ? SENTRY_SAMPLE_RATE_DEFAULT : 1),
      };
    }
    if (stored?.enabled && stored.dsnApi && isValidDsn(stored.dsnApi)) {
      return {
        active: true,
        source: 'stored',
        dsnApi: stored.dsnApi,
        dsnBrowser: stored.dsnBrowser,
        environment: envName || stored.environment,
        sampleRate: stored.sampleRate,
      };
    }
    return { active: false, source: 'none', dsnApi: null, dsnBrowser: null, environment: stored?.environment ?? 'production', sampleRate: stored?.sampleRate ?? SENTRY_SAMPLE_RATE_DEFAULT };
  }

  async getLastTest(): Promise<SentryLastTest | null> {
    try {
      const raw = (await this.rows()).get(K.lastTest);
      return raw ? (JSON.parse(raw) as SentryLastTest) : null;
    } catch {
      return null;
    }
  }

  async saveLastTest(result: SentryTestResult): Promise<SentryLastTest> {
    const last: SentryLastTest = { at: new Date().toISOString(), ok: result.ok, code: result.code, httpStatus: result.httpStatus };
    await this.write([[K.lastTest, JSON.stringify(last)]]);
    return last;
  }

  async getPublic(): Promise<SupervisionPublicConfig> {
    const rows = await this.rows(true);
    const stored = this.parseSentry(rows);
    const effective = await this.getEffectiveSentry();
    const lastRaw = rows.get(K.lastTest);
    return {
      local: { ...this.parseLocal(rows), alwaysActive: true },
      sentry: {
        enabled: stored.enabled || effective.source === 'environment',
        active: effective.active,
        source: effective.source,
        dsnApiSet: !!effective.dsnApi || !!stored.dsnApi,
        dsnApiUnreadable: stored.dsnApiUnreadable && effective.source !== 'environment',
        dsnApiHint: describeDsn(effective.dsnApi ?? stored.dsnApi),
        dsnBrowserSet: !!effective.dsnBrowser,
        dsnBrowserHint: describeDsn(effective.dsnBrowser),
        environment: effective.environment,
        sampleRate: effective.sampleRate,
        sampleRateMax: SENTRY_SAMPLE_RATE_MAX,
        lastTest: lastRaw ? (JSON.parse(lastRaw) as SentryLastTest) : null,
      },
    };
  }

  private async write(entries: Array<[string, string]>, deletions: string[] = []) {
    await this.database.$transaction([
      ...entries.map(([key, value]) =>
        this.database.gameConfig.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
      ...(deletions.length ? [this.database.gameConfig.deleteMany({ where: { key: { in: deletions } } })] : []),
    ]);
    this.invalidate();
  }

  /** Enregistre les champs fournis ; retourne les noms des champs modifiés (jamais les valeurs). */
  async update(changes: SupervisionUpdate): Promise<string[]> {
    const before = await this.getPublic();
    const entries: Array<[string, string]> = [];
    const deletions: string[] = [];
    const changed: string[] = [];

    const local = changes.local ?? {};
    const setLocal = <T extends keyof LocalSettings>(field: T, key: string, value: string) => {
      if (local[field] === undefined) return;
      if (local[field] !== before.local[field]) changed.push(`local.${field}`);
      entries.push([key, value]);
    };
    if (local.retentionDays !== undefined) setLocal('retentionDays', K.retentionDays, String(clamp(Math.round(local.retentionDays), LOCAL_LIMITS.retentionDays.min, LOCAL_LIMITS.retentionDays.max)));
    if (local.maxIncidents !== undefined) setLocal('maxIncidents', K.maxIncidents, String(clamp(Math.round(local.maxIncidents), LOCAL_LIMITS.maxIncidents.min, LOCAL_LIMITS.maxIncidents.max)));
    if (local.minLevel !== undefined) setLocal('minLevel', K.minLevel, local.minLevel === 'fatal' ? 'fatal' : 'error');
    if (local.warningsEnabled !== undefined) setLocal('warningsEnabled', K.warningsEnabled, String(local.warningsEnabled));
    if (local.autoPurge !== undefined) setLocal('autoPurge', K.autoPurge, String(local.autoPurge));

    const sentry = changes.sentry ?? {};
    if (sentry.enabled !== undefined) {
      if (sentry.enabled !== before.sentry.enabled) changed.push('sentry.enabled');
      entries.push([K.sentryEnabled, String(sentry.enabled)]);
    }
    if (sentry.dsnApi) {
      entries.push([K.dsnApi, encryptSecret(sentry.dsnApi)]);
      changed.push('sentry.dsnApi');
    } else if (sentry.clearDsnApi) {
      deletions.push(K.dsnApi);
      changed.push('sentry.dsnApi');
    }
    if (sentry.dsnBrowser) {
      entries.push([K.dsnBrowser, encryptSecret(sentry.dsnBrowser)]);
      changed.push('sentry.dsnBrowser');
    } else if (sentry.clearDsnBrowser) {
      deletions.push(K.dsnBrowser);
      changed.push('sentry.dsnBrowser');
    }
    if (sentry.environment !== undefined) {
      if (sentry.environment !== before.sentry.environment) changed.push('sentry.environment');
      entries.push([K.sentryEnv, sentry.environment]);
    }
    if (sentry.sampleRate !== undefined) {
      const rate = clamp(sentry.sampleRate, 0, SENTRY_SAMPLE_RATE_MAX);
      if (rate !== before.sentry.sampleRate) changed.push('sentry.sampleRate');
      entries.push([K.sampleRate, String(rate)]);
    }

    if (entries.length || deletions.length) await this.write(entries, deletions);
    return changed;
  }

  /** Supprime toute la configuration Sentry enregistrée (la supervision locale reste active). */
  async clearSentry(): Promise<void> {
    await this.write([], [K.sentryEnabled, K.dsnApi, K.dsnBrowser, K.sentryEnv, K.sampleRate, K.lastTest]);
  }
}
