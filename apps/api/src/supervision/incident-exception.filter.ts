import { ArgumentsHost, Catch, HttpException, Inject } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { reportIncident } from './incident-sink';

/**
 * Filtre global : comportement de réponse inchangé (celui de Nest), mais toute erreur serveur (5xx ou exception
 * inattendue) est aussi enregistrée comme incident. Seule la route normalisée, le statut et l'identifiant du
 * joueur sont conservés : jamais le corps de la requête, les en-têtes ni les cookies.
 */
@Catch()
export class IncidentExceptionFilter extends BaseExceptionFilter {
  constructor(@Inject(HttpAdapterHost) adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    try {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      if (status >= 500 && host.getType() === 'http') {
        const request = host.switchToHttp().getRequest<{ method?: string; route?: { path?: string }; originalUrl?: string; url?: string; user?: { id?: string } }>();
        reportIncident({
          level: 'error',
          source: 'api',
          error: exception instanceof Error ? exception : undefined,
          message: exception instanceof Error ? exception.message : 'exception inattendue',
          operation: `${request?.method ?? ''} ${request?.route?.path ?? request?.originalUrl ?? request?.url ?? ''}`.trim(),
          httpStatus: status,
          userId: request?.user?.id,
        });
      }
    } catch {
      /* ne jamais perturber la réponse */
    }
    super.catch(exception, host);
  }
}
