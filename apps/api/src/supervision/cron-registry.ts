/**
 * Registre des tâches planifiées : chaque exécution laisse un battement de cœur. Une tâche dont le dernier
 * battement dépasse largement son intervalle est considérée comme bloquée par la supervision.
 */
export interface CronBeat {
  name: string;
  intervalMs: number;
  lastRunAt: number;
  lastDurationMs: number;
  lastError?: string;
  runs: number;
}

class CronRegistry {
  private readonly beats = new Map<string, CronBeat>();

  beat(name: string, intervalMs: number, durationMs: number, error?: string) {
    const previous = this.beats.get(name);
    this.beats.set(name, {
      name,
      intervalMs,
      lastRunAt: Date.now(),
      lastDurationMs: durationMs,
      lastError: error,
      runs: (previous?.runs ?? 0) + 1,
    });
  }

  /** Déclare une tâche attendue avant sa première exécution (fenêtre de grâce depuis le démarrage). */
  expect(name: string, intervalMs: number) {
    if (!this.beats.has(name)) this.beats.set(name, { name, intervalMs, lastRunAt: Date.now(), lastDurationMs: 0, runs: 0 });
  }

  snapshot(): CronBeat[] {
    return [...this.beats.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  reset() {
    this.beats.clear();
  }
}

export const cronRegistry = new CronRegistry();

/**
 * Décorateur à placer SOUS `@Cron(...)` : enregistre le battement de la tâche et signale ses erreurs
 * (la méthode d'origine reste inchangée : le comportement métier n'est pas modifié).
 */
export function MonitoredCron(name: string, intervalMs: number): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    cronRegistry.expect(name, intervalMs);
    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const started = Date.now();
      try {
        const result = await original.apply(this, args);
        cronRegistry.beat(name, intervalMs, Date.now() - started);
        return result;
      } catch (error) {
        cronRegistry.beat(name, intervalMs, Date.now() - started, (error as Error)?.message?.slice(0, 200) ?? 'erreur');
        throw error;
      }
    };
    return descriptor;
  };
}
