import { getApiBaseUrl } from "@/lib/api/client";

interface PublicConfig {
  sentry?: { enabled: boolean; dsn?: string; environment?: string; sampleRate?: number };
}

let started = false;

/**
 * Sentry navigateur, activé à l'exécution (sans recompilation) : la configuration publique est lue auprès de
 * l'API. Si Sentry est désactivé, injoignable ou déjà initialisé par le DSN compilé, rien ne se passe. Le SDK
 * n'est téléchargé que lorsqu'il est réellement actif.
 */
export async function loadRuntimeSentry(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const response = await fetch(`${getApiBaseUrl()}/monitoring/public-config`, { cache: "no-store" });
    if (!response.ok) return;
    const config = (await response.json()) as PublicConfig;
    if (!config.sentry?.enabled || !config.sentry.dsn) return;
    const Sentry = await import("@sentry/nextjs");
    if (Sentry.getClient()) return; // déjà initialisé par le DSN compilé (NEXT_PUBLIC_SENTRY_DSN)
    const rate = Math.min(0.5, Math.max(0, config.sentry.sampleRate ?? 0.1));
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment || "production",
      tracesSampleRate: rate,
      debug: false,
    });
  } catch {
    // Sentry est optionnel : une erreur ici ne doit jamais gêner le jeu
  }
}
