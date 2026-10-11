import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/security/rate-limit.guard';
import { ClientErrorDto } from './dto';
import { reportIncident } from './incident-sink';
import { SupervisionConfigService } from './supervision-config.service';

/**
 * Routes publiques minimales de la supervision :
 * - réception des erreurs du navigateur (schéma strict, taille bornée, débit limité par adresse IP) ;
 * - configuration d'exécution du navigateur : uniquement ce que le navigateur est autorisé à connaître.
 *   Le DSN navigateur est public par nature ; il n'est jamais un jeton secret et n'est servi que si Sentry est actif.
 */
@Controller('monitoring')
@UseGuards(RateLimitGuard)
export class ClientReportsController {
  private publicCache: { at: number; value: unknown } | null = null;

  constructor(private readonly config: SupervisionConfigService) {}

  @Post('client-errors')
  @RateLimit('clienterror')
  @HttpCode(HttpStatus.ACCEPTED)
  report(@Body() dto: ClientErrorDto) {
    const error = Object.assign(new Error(dto.message), { name: dto.type || 'ClientError', stack: dto.stack });
    reportIncident({
      level: 'error',
      source: 'frontend',
      error,
      message: dto.message,
      errorType: dto.type || 'ClientError',
      operation: dto.route,
      context: { kind: dto.kind },
      count: dto.count,
    });
    return { accepted: true };
  }

  @Get('public-config')
  async publicConfig() {
    if (this.publicCache && Date.now() - this.publicCache.at < 30_000) return this.publicCache.value;
    const effective = await this.config.getEffectiveSentry();
    const browserDsn = effective.active ? effective.dsnBrowser : null;
    const value = {
      clientReporting: true,
      sentry: browserDsn
        ? { enabled: true, dsn: browserDsn, environment: effective.environment, sampleRate: effective.sampleRate }
        : { enabled: false },
    };
    this.publicCache = { at: Date.now(), value };
    return value;
  }
}
