import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GameEventsModule } from '../game-events/game-events.module';
import { MailModule } from '../mail/mail.module';
import { ClientReportsController } from './client-reports.controller';
import { HealthService } from './health.service';
import { IncidentExceptionFilter } from './incident-exception.filter';
import { IncidentQueryService } from './incident-query.service';
import { IncidentService } from './incident.service';
import { SupervisionPurgeCronService } from './purge-cron.service';
import { SentryRuntimeService } from './sentry-runtime.service';
import { SupervisionConfigService } from './supervision-config.service';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';

/** Supervision locale intégrée (toujours active) et Sentry externe optionnel. */
@Global()
@Module({
  imports: [GameEventsModule, MailModule],
  controllers: [SupervisionController, ClientReportsController],
  providers: [
    SupervisionConfigService,
    IncidentService,
    IncidentQueryService,
    HealthService,
    SentryRuntimeService,
    SupervisionService,
    SupervisionPurgeCronService,
    { provide: APP_FILTER, useClass: IncidentExceptionFilter },
  ],
  exports: [SupervisionConfigService, IncidentService, SupervisionService],
})
export class SupervisionModule {}
