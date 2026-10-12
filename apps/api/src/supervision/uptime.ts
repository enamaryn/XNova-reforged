/**
 * Calcul de disponibilité à partir des échantillons de santé (un par minute). Fonction pure, testée.
 * - Fenêtre : de max(maintenant − durée, premier échantillon) à maintenant ; on ne compte pas le temps d'avant
 *   la première mesure (sinon un serveur neuf afficherait 0 %).
 * - Une minute sans échantillon est une minute d'indisponibilité (processus arrêté, base injoignable).
 * - Disponibilité = minutes avec échantillon « healthy » ou « degraded » ; « parfait » = seulement « healthy ».
 */
export const SAMPLE_INTERVAL_MS = 60_000;

export interface UptimeSample {
  at: Date;
  status: string;
}

export interface UptimeResult {
  windowMinutes: number;
  availablePercent: number | null;
  healthyPercent: number | null;
  downMinutes: number;
  /** Nombre de périodes d'indisponibilité distinctes (minutes manquantes ou « unavailable » consécutives). */
  outages: number;
  /** Début de la mesure : null tant qu'aucun échantillon n'existe. */
  measuredSince: string | null;
}

const minuteOf = (date: Date) => Math.floor(date.getTime() / SAMPLE_INTERVAL_MS);

export function computeUptime(samples: UptimeSample[], windowMs: number, now: Date, firstSampleAt: Date | null): UptimeResult {
  if (!firstSampleAt) return { windowMinutes: 0, availablePercent: null, healthyPercent: null, downMinutes: 0, outages: 0, measuredSince: null };
  const endMinute = minuteOf(now);
  const startMinute = Math.max(minuteOf(new Date(now.getTime() - windowMs)), minuteOf(firstSampleAt));
  // La minute en cours n'est pas terminée : elle n'est comptée qu'une fois échantillonnée
  const lastMinute = endMinute - 1;
  const total = Math.max(0, lastMinute - startMinute + 1);
  if (total === 0) return { windowMinutes: 0, availablePercent: null, healthyPercent: null, downMinutes: 0, outages: 0, measuredSince: firstSampleAt.toISOString() };

  const byMinute = new Map<number, string>();
  for (const sample of samples) byMinute.set(minuteOf(sample.at), sample.status);

  let available = 0;
  let healthy = 0;
  let outages = 0;
  let inOutage = false;
  for (let minute = startMinute; minute <= lastMinute; minute += 1) {
    const status = byMinute.get(minute);
    const up = status === 'healthy' || status === 'degraded';
    if (up) available += 1;
    if (status === 'healthy') healthy += 1;
    if (!up && !inOutage) outages += 1;
    inOutage = !up;
  }
  const pct = (value: number) => Math.round((value / total) * 10_000) / 100;
  return {
    windowMinutes: total,
    availablePercent: pct(available),
    healthyPercent: pct(healthy),
    downMinutes: total - available,
    outages,
    measuredSince: firstSampleAt.toISOString(),
  };
}
