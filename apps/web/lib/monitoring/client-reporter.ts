import { getApiBaseUrl } from "@/lib/api/client";

/**
 * Remontée des erreurs critiques du navigateur vers la supervision locale de l'API.
 * Garde-fous : jamais d'exception vers l'appelant, anti-boucle (une erreur levée pendant l'envoi n'est jamais
 * re-signalée), anti-doublon (même erreur regroupée en un seul envoi avec compteur) et débit borné (le serveur
 * limite aussi par adresse).
 */
export type ClientErrorKind = "react" | "window" | "promise" | "network";

export interface ClientErrorInput {
  message: string;
  type?: string;
  stack?: string;
  route?: string;
  kind: ClientErrorKind;
}

export const MAX_REPORTS_PER_MINUTE = 6;
const FLUSH_DELAY_MS = 2000;
const MAX_PENDING = 20;

interface Pending extends ClientErrorInput {
  count: number;
}

const pending = new Map<string, Pending>();
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let windowStart = 0;
let sentInWindow = 0;
let installed = false;

const cut = (value: string | undefined, max: number) => (value ? value.slice(0, max) : undefined);

function currentRoute() {
  try {
    return window.location.pathname.slice(0, 200);
  } catch {
    return undefined;
  }
}

/** Autorise un envoi dans la limite du débit navigateur (fenêtre glissante d'une minute). */
function takeSlot(now: number) {
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_REPORTS_PER_MINUTE) return false;
  sentInWindow += 1;
  return true;
}

async function flush() {
  timer = null;
  if (sending || pending.size === 0) return;
  sending = true; // anti-boucle : tout ce qui se produit pendant l'envoi est ignoré
  try {
    const items = [...pending.entries()];
    pending.clear();
    for (const [, item] of items) {
      if (!takeSlot(Date.now())) break;
      try {
        await fetch(`${getApiBaseUrl()}/monitoring/client-errors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            message: cut(item.message, 500),
            type: cut(item.type, 80),
            stack: cut(item.stack, 4000),
            route: cut(item.route, 200),
            kind: item.kind,
            count: Math.min(item.count, 100),
          }),
        });
      } catch {
        // Serveur injoignable : silence, le jeu continue
      }
    }
  } finally {
    sending = false;
  }
}

/** Met une erreur en file d'envoi. N'échoue jamais. */
export function reportClientError(input: ClientErrorInput): void {
  try {
    if (typeof window === "undefined" || sending) return;
    const message = (input.message || "Erreur sans message").slice(0, 500);
    const key = `${input.kind}|${input.type ?? ""}|${message}`;
    const existing = pending.get(key);
    if (existing) {
      existing.count += 1;
    } else if (pending.size < MAX_PENDING) {
      pending.set(key, { ...input, message, route: input.route ?? currentRoute(), count: 1 });
    }
    if (!timer) timer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
  } catch {
    // jamais d'exception vers l'appelant
  }
}

/** Erreurs globales et promesses rejetées ; idempotent. */
export function installGlobalErrorReporting(): () => void {
  if (typeof window === "undefined" || installed) return () => undefined;
  installed = true;
  const onError = (event: ErrorEvent) => {
    // Les erreurs de chargement de ressources (images…) n'ont pas d'objet d'erreur : ignorées
    if (!event.error && !event.message) return;
    reportClientError({
      kind: "window",
      type: (event.error as Error | undefined)?.name,
      message: event.message || String(event.error),
      stack: (event.error as Error | undefined)?.stack,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as Error | string | undefined;
    reportClientError({
      kind: "promise",
      type: typeof reason === "object" ? reason?.name : undefined,
      message: typeof reason === "string" ? reason : reason?.message ?? "Promesse rejetée",
      stack: typeof reason === "object" ? reason?.stack : undefined,
    });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}

/** Réservé aux tests. */
export function resetClientReporterForTests() {
  pending.clear();
  if (timer) clearTimeout(timer);
  timer = null;
  sending = false;
  windowStart = 0;
  sentInWindow = 0;
}
