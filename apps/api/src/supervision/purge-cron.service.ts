import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoredCron } from './cron-registry';
import { IncidentQueryService } from './incident-query.service';
import { IncidentService } from './incident.service';
import { SupervisionConfigService } from './supervision-config.service';

/** Purge automatique des incidents anciens (rétention configurable) et plafond du nombre d'incidents distincts. */
@Injectable()
export class SupervisionPurgeCronService {
  constructor(
    private readonly config: SupervisionConfigService,
    private readonly query: IncidentQueryService,
    private readonly incidents: IncidentService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  @MonitoredCron('supervision-purge', 3_600_000)
  async purge() {
    const local = await this.config.getLocal();
    if (!local.autoPurge) return;
    await this.query.purgeByRetention(local.retentionDays);
    await this.incidents.trim(local.maxIncidents);
  }
}
