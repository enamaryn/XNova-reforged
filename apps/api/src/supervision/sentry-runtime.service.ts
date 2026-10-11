import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { initSentry } from '../monitoring/sentry';
import { IncidentService } from './incident.service';
import { SupervisionConfigService } from './supervision-config.service';

/**
 * Sentry externe : jamais requis. Il suit la configuration effective (variable d'environnement > configuration
 * chiffrée > désactivé) et peut être activé, modifié ou retiré à chaud, sans redémarrage. Toute défaillance
 * est absorbée : le jeu et la supervision locale continuent.
 */
@Injectable()
export class SentryRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SentryRuntimeService.name);
  private startedByUs = false;
  private activeKey: string | null = null;

  constructor(
    private readonly config: SupervisionConfigService,
    private readonly incidents: IncidentService,
  ) {}

  async onModuleInit() {
    await this.apply();
  }

  async onModuleDestroy() {
    this.incidents.setExternalForwarder(null);
    if (this.startedByUs) await Sentry.close(1500).catch(() => undefined);
  }

  get active(): boolean {
    return this.activeKey !== null;
  }

  /** Applique la configuration effective ; ne lève jamais. */
  async apply(): Promise<void> {
    try {
      const effective = await this.config.getEffectiveSentry();
      if (!effective.active || !effective.dsnApi) {
        await this.stop();
        return;
      }
      const key = `${effective.source}|${effective.dsnApi}|${effective.environment}|${effective.sampleRate}`;
      if (this.activeKey === key) return;

      if (effective.source === 'stored') {
        // Configuration enregistrée : (ré)initialiser le SDK avec ces valeurs
        if (this.startedByUs) await Sentry.close(1500).catch(() => undefined);
        initSentry(effective.dsnApi, effective.environment, effective.sampleRate);
        this.startedByUs = true;
      }
      // Source « environnement » : le SDK est déjà initialisé au démarrage (main.ts), seul le relais est branché
      this.activeKey = key;
      this.incidents.setExternalForwarder(({ level, error, message }) => {
        if (level === 'warning') return;
        if (error instanceof Error) Sentry.captureException(error);
        else Sentry.captureMessage(message, level === 'fatal' ? 'fatal' : 'error');
      });
    } catch (error) {
      this.logger.debug(`Sentry non appliqué : ${(error as Error)?.message ?? 'erreur'}`);
    }
  }

  private async stop() {
    this.incidents.setExternalForwarder(null);
    this.activeKey = null;
    if (this.startedByUs) {
      this.startedByUs = false;
      await Sentry.close(1500).catch(() => undefined);
    }
  }
}
