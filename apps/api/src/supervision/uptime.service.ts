import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { getBuildInfo } from './build-info';
import { MonitoredCron } from './cron-registry';
import { HealthService } from './health.service';
import { SAMPLE_INTERVAL_MS, computeUptime, type UptimeResult } from './uptime';

const RETENTION_MS = 90 * 86_400_000;
const WINDOWS = { last24h: 86_400_000, last7d: 7 * 86_400_000, last30d: 30 * 86_400_000 } as const;

/** Échantillonne la santé chaque minute et expose le pourcentage de disponibilité (24 h, 7 j, 30 j). */
@Injectable()
export class UptimeService {
  private runs = 0;

  constructor(
    private readonly database: DatabaseService,
    private readonly health: HealthService,
  ) {}

  /** Écrit l'échantillon de la minute en cours (idempotent : plusieurs instances n'en écrivent qu'un). */
  async sample(now: Date = new Date()): Promise<void> {
    const result = await this.health.checkAll();
    const at = new Date(Math.floor(now.getTime() / SAMPLE_INTERVAL_MS) * SAMPLE_INTERVAL_MS);
    const failing = result.checks.filter((check) => check.status === 'down' || check.status === 'degraded').map((check) => check.id);
    await this.database.healthSample.createMany({
      data: [{ at, status: result.status, failing: failing.length ? failing.join(',') : null, version: getBuildInfo().version }],
      skipDuplicates: true,
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  @MonitoredCron('uptime-sample', 60_000)
  async tick() {
    await this.sample();
    // Purge des échantillons de plus de 90 jours, une fois par heure environ
    this.runs += 1;
    if (this.runs % 60 === 1) await this.database.healthSample.deleteMany({ where: { at: { lt: new Date(Date.now() - RETENTION_MS) } } });
  }

  async summary(now: Date = new Date()): Promise<Record<keyof typeof WINDOWS, UptimeResult>> {
    const first = await this.database.healthSample.findFirst({ orderBy: { at: 'asc' }, select: { at: true } });
    const oldest = new Date(now.getTime() - WINDOWS.last30d);
    const samples = await this.database.healthSample.findMany({ where: { at: { gte: oldest } }, select: { at: true, status: true } });
    return Object.fromEntries(
      (Object.keys(WINDOWS) as Array<keyof typeof WINDOWS>).map((key) => [key, computeUptime(samples, WINDOWS[key], now, first?.at ?? null)]),
    ) as Record<keyof typeof WINDOWS, UptimeResult>;
  }
}
