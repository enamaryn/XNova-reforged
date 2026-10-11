import { ConsoleLogger } from '@nestjs/common';
import { reportIncident, type IncidentSource } from './incident-sink';

/** Déduit l'origine d'un incident à partir du nom du composant qui journalise. */
export function sourceFromContext(context: string | undefined): IncidentSource {
  const name = (context ?? '').toLowerCase();
  if (/cron|schedule/.test(name)) return 'cron';
  if (/redis/.test(name)) return 'redis';
  if (/database|prisma/.test(name)) return 'database';
  if (/mail|smtp/.test(name)) return 'smtp';
  if (/gateway|socket|events/.test(name)) return 'websocket';
  return 'api';
}

/** Contextes déjà traités ailleurs (filtre d'exceptions) : ne pas enregistrer deux fois la même erreur. */
const IGNORED_CONTEXTS = new Set(['ExceptionsHandler', 'ExceptionHandler']);

/**
 * Journal NestJS standard (sortie console / journald inchangée) qui signale aussi les erreurs (et les
 * avertissements, si la supervision locale les accepte) comme incidents. Aucune récursion : le service
 * d'incidents n'écrit jamais via ce journal.
 */
export class SupervisedLogger extends ConsoleLogger {
  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    this.forward('error', message, optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams);
    this.forward('warning', message, optionalParams);
  }

  private forward(level: 'error' | 'warning', message: unknown, params: unknown[]) {
    const last = params[params.length - 1];
    const context = typeof last === 'string' ? last : this.context;
    if (context && IGNORED_CONTEXTS.has(context)) return;
    // Nest passe la trace en deuxième paramètre pour `error(message, stack, context)`
    const stackParam = params.find((p) => typeof p === 'string' && /\n\s+at\s/.test(p));
    const errorLike = message instanceof Error ? message : params.find((p): p is Error => p instanceof Error);
    reportIncident({
      level,
      source: sourceFromContext(context),
      error: errorLike ?? (stackParam ? Object.assign(new Error(String(message)), { stack: String(stackParam) }) : undefined),
      message: message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message),
      operation: context,
    });
  }
}
