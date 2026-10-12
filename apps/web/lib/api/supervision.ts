import { useAuthStore } from "@/lib/stores/auth-store";
import { apiClient, apiRequest, getApiBaseUrl } from "./client";

export type CheckStatus = "ok" | "degraded" | "down" | "unknown";
export type OverallStatus = "healthy" | "degraded" | "unavailable";

export interface HealthCheck {
  id: string;
  status: CheckStatus;
  code: string;
  message: string;
  durationMs: number;
  checkedAt: string;
  details: Record<string, unknown>;
}

export interface IncidentSummary {
  id: string;
  level: "warning" | "error" | "fatal";
  source: string;
  status: "new" | "seen" | "resolved" | "ignored";
  message: string;
  errorType: string | null;
  operation: string | null;
  httpStatus: number | null;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
}

export interface IncidentDetail extends IncidentSummary {
  userId: string | null;
  planetId: string | null;
  version: string | null;
  commit: string | null;
  context: unknown;
  stack: string | null;
  resolvedAt: string | null;
}

export interface LocalSettings {
  retentionDays: number;
  maxIncidents: number;
  minLevel: "error" | "fatal";
  warningsEnabled: boolean;
  autoPurge: boolean;
  alwaysActive: true;
}

export interface SentryLastTest {
  at: string;
  ok: boolean;
  code: string;
  httpStatus?: number;
}

export interface SupervisionConfig {
  local: LocalSettings;
  sentry: {
    enabled: boolean;
    active: boolean;
    source: "environment" | "stored" | "none";
    dsnApiSet: boolean;
    dsnApiUnreadable: boolean;
    dsnApiHint: string | null;
    dsnBrowserSet: boolean;
    dsnBrowserHint: string | null;
    environment: string;
    sampleRate: number;
    sampleRateMax: number;
    lastTest: SentryLastTest | null;
  };
}

export interface UptimeWindow {
  windowMinutes: number;
  availablePercent: number | null;
  healthyPercent: number | null;
  downMinutes: number;
  outages: number;
  measuredSince: string | null;
}

export interface SupervisionOverview {
  uptime?: { last24h: UptimeWindow; last7d: UptimeWindow; last30d: UptimeWindow } | null;
  localActive: true;
  health: { status: OverallStatus; checkedAt: string; checks: HealthCheck[] };
  stats: {
    open: number;
    total: number;
    last24h: number;
    occurrences24h: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    top: IncidentSummary[];
  } | null;
  config: SupervisionConfig;
}

export interface SupervisionUpdatePayload {
  local?: Partial<Omit<LocalSettings, "alwaysActive">>;
  sentry?: {
    enabled?: boolean;
    dsnApi?: string;
    dsnBrowser?: string;
    clearDsnApi?: boolean;
    clearDsnBrowser?: boolean;
    environment?: string;
    sampleRate?: number;
  };
}

export interface SentryTestResult {
  ok: boolean;
  code: string;
  httpStatus: number | null;
  message: string;
  lastTest: SentryLastTest | null;
}

export interface IncidentFiltersQuery {
  period?: string;
  level?: string;
  source?: string;
  status?: string;
  q?: string;
  sort?: "lastSeen" | "occurrences";
  page?: number;
  pageSize?: number;
}

const toQuery = (filters: IncidentFiltersQuery) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const getSupervisionOverview = () => apiClient.get<SupervisionOverview>("/admin/supervision/overview");
export const getSupervisionConfig = () => apiClient.get<SupervisionConfig>("/admin/supervision/config");
export const updateSupervisionConfig = (payload: SupervisionUpdatePayload) =>
  apiClient.put<SupervisionConfig>("/admin/supervision/config", payload);
export const clearSentryConfig = () => apiClient.delete<SupervisionConfig>("/admin/supervision/sentry");
export const testSentry = (dsnApi?: string) =>
  apiClient.post<SentryTestResult>("/admin/supervision/sentry/test", dsnApi ? { dsnApi } : {});
export const listIncidents = (filters: IncidentFiltersQuery) =>
  apiClient.get<{ items: IncidentSummary[]; total: number; page: number; pageSize: number; pages: number }>(
    `/admin/supervision/incidents${toQuery(filters)}`,
  );
export const getIncident = (id: string) => apiClient.get<IncidentDetail>(`/admin/supervision/incidents/${id}`);
export const setIncidentStatus = (id: string, status: IncidentSummary["status"]) =>
  apiRequest<IncidentDetail>(`/admin/supervision/incidents/${id}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status }),
  });
export const purgeIncidents = (olderThanDays: number, onlyClosed: boolean) =>
  apiClient.post<{ deleted: number }>("/admin/supervision/purge", { confirm: true, olderThanDays, onlyClosed });

/** Export : téléchargement authentifié (Blob) pour que le navigateur enregistre un fichier. */
export async function exportIncidents(filters: IncidentFiltersQuery, format: "json" | "csv") {
  const token = useAuthStore.getState().tokens?.accessToken;
  const query = toQuery({ ...filters, page: undefined, pageSize: undefined });
  const url = `${getApiBaseUrl()}/admin/supervision/export${query}${query ? "&" : "?"}format=${format}`;
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error(String(response.status));
  return response.blob();
}
