"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearSentryConfig,
  exportIncidents,
  getIncident,
  getSupervisionOverview,
  listIncidents,
  purgeIncidents,
  setIncidentStatus,
  testSentry,
  updateSupervisionConfig,
  type CheckStatus,
  type HealthCheck,
  type IncidentSummary,
  type OverallStatus,
} from "@/lib/api/supervision";
import { SupervisionSettingsForm } from "@/components/monitoring/SupervisionSettingsForm";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isSuperAdmin } from "@/lib/roles";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

const OVERALL_STYLE: Record<OverallStatus, string> = {
  healthy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  degraded: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  unavailable: "border-red-500/40 bg-red-500/10 text-red-200",
};
const CHECK_STYLE: Record<CheckStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-300",
  degraded: "bg-amber-500/15 text-amber-300",
  down: "bg-red-500/15 text-red-300",
  unknown: "bg-slate-500/15 text-slate-300",
};
const LEVEL_STYLE: Record<string, string> = {
  warning: "bg-amber-500/15 text-amber-300",
  error: "bg-red-500/15 text-red-300",
  fatal: "bg-fuchsia-500/20 text-fuchsia-200",
};

const PERIODS = ["1h", "24h", "7d", "30d", "all"] as const;
const LEVELS = ["warning", "error", "fatal"] as const;
const SOURCES = ["api", "frontend", "websocket", "cron", "smtp", "database", "redis", "system"] as const;
const STATUSES = ["new", "seen", "resolved", "ignored"] as const;

function CheckCard({ check }: { check: HealthCheck }) {
  const { t } = useI18n();
  const translated = t(`supervision.code.${check.code}`);
  const text = translated === `supervision.code.${check.code}` ? check.message : translated;
  const details = Object.entries(check.details ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && typeof value !== "object" && String(value).length <= 40,
  );
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" data-testid={`check-${check.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{t(`supervision.service.${check.id}`)}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${CHECK_STYLE[check.status]}`}>{t(`supervision.checkStatus.${check.status}`)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-300">{text}</p>
      {details.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {details.slice(0, 5).map(([key, value]) => (
            <div key={key} className="contents">
              <dt>{key}</dt>
              <dd className="truncate text-slate-400">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[11px] text-slate-600">
        {check.durationMs} ms · {new Date(check.checkedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

function IncidentDetail({ id, canEdit, onChanged }: { id: string; canEdit: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ["supervision", "incident", id], queryFn: () => getIncident(id) });
  const mutation = useMutation({
    mutationFn: (status: IncidentSummary["status"]) => setIncidentStatus(id, status),
    onSuccess: onChanged,
  });
  if (!query.data) return <p className="p-3 text-xs text-slate-500">{t("supervision.loading")}</p>;
  const d = query.data;
  return (
    <div className="space-y-3 border-t border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300" data-testid="incident-detail">
      <p className="break-words text-sm text-white">{d.message}</p>
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <div>{t("supervision.incident.firstSeen")} : {new Date(d.firstSeen).toLocaleString()}</div>
        <div>{t("supervision.incident.lastSeen")} : {new Date(d.lastSeen).toLocaleString()}</div>
        <div>{t("supervision.incident.route")} : {d.operation ?? "—"}</div>
        <div>{t("supervision.incident.httpStatus")} : {d.httpStatus ?? "—"}</div>
        <div>{t("supervision.incident.version")} : {d.version ?? "—"} {d.commit ? `(${d.commit})` : ""}</div>
        <div>{t("supervision.incident.type")} : {d.errorType ?? "—"}</div>
        {d.userId && <div>{t("supervision.incident.user")} : {d.userId}</div>}
        {d.resolvedAt && <div>{t("supervision.incident.resolvedAt")} : {new Date(d.resolvedAt).toLocaleString()}</div>}
      </dl>
      {d.stack && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/40 p-2 text-[11px] text-slate-400">{d.stack}</pre>}
      {d.context !== null && d.context !== undefined && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/40 p-2 text-[11px] text-slate-400">{JSON.stringify(d.context, null, 2)}</pre>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {d.status !== "seen" && d.status !== "resolved" && (
            <button className={button} onClick={() => mutation.mutate("seen")} disabled={mutation.isPending}>{t("supervision.actions.seen")}</button>
          )}
          {d.status !== "resolved" && (
            <button className={button} onClick={() => mutation.mutate("resolved")} disabled={mutation.isPending} data-testid="incident-resolve">{t("supervision.actions.resolve")}</button>
          )}
          {d.status !== "ignored" && (
            <button className={button} onClick={() => mutation.mutate("ignored")} disabled={mutation.isPending}>{t("supervision.actions.ignore")}</button>
          )}
          {(d.status === "resolved" || d.status === "ignored") && (
            <button className={button} onClick={() => mutation.mutate("new")} disabled={mutation.isPending}>{t("supervision.actions.reopen")}</button>
          )}
        </div>
      )}
    </div>
  );
}

export function SupervisionPanel() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canEdit = isSuperAdmin(user?.role);
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ period: "24h", level: "", source: "", status: "", q: "", sort: "lastSeen" as "lastSeen" | "occurrences" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [purge, setPurge] = useState({ days: "30", onlyClosed: true });

  const overview = useQuery({ queryKey: ["supervision", "overview"], queryFn: getSupervisionOverview, refetchInterval: 60_000 });
  const incidents = useQuery({
    queryKey: ["supervision", "incidents", filters, page],
    queryFn: () => listIncidents({ ...filters, page, pageSize: 20 }),
    placeholderData: (previous) => previous,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["supervision"] });
  };

  const save = useMutation({
    mutationFn: updateSupervisionConfig,
    onSuccess: () => {
      setNotice({ kind: "ok", text: t("supervision.saved") });
      refresh();
    },
    onError: (error: Error) => setNotice({ kind: "error", text: error.message }),
  });
  const clear = useMutation({
    mutationFn: clearSentryConfig,
    onSuccess: () => {
      setNotice({ kind: "ok", text: t("supervision.sentry.cleared") });
      refresh();
    },
    onError: (error: Error) => setNotice({ kind: "error", text: error.message }),
  });
  const purgeMutation = useMutation({
    mutationFn: () => purgeIncidents(Number(purge.days), purge.onlyClosed),
    onSuccess: (result) => {
      setNotice({ kind: "ok", text: t("supervision.purge.done", { count: result.deleted }) });
      refresh();
    },
    onError: (error: Error) => setNotice({ kind: "error", text: error.message }),
  });

  const download = async (format: "json" | "csv") => {
    try {
      const blob = await exportIncidents({ ...filters }, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `incidents.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  if (overview.isLoading) return <p className="text-sm text-slate-400">{t("supervision.loading")}</p>;
  if (overview.isError || !overview.data) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {t("supervision.loadError")}
        <button onClick={() => overview.refetch()} className="ml-4 underline">{t("common.retry")}</button>
      </div>
    );
  }

  const { health, stats, config, uptime } = overview.data;
  const version = health.checks.find((check) => check.id === "version");
  const items = incidents.data?.items ?? [];

  return (
    <div className="space-y-6" data-testid="supervision-panel">
      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-2xl border p-3 text-sm ${notice.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
          {notice.text}
        </p>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-white">{t("supervision.title")}</h2>
            <span data-testid="overall-status" className={`rounded-full border px-3 py-1 text-xs ${OVERALL_STYLE[health.status]}`}>
              {t(`supervision.overall.${health.status}`)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{t("supervision.lastCheck", { time: new Date(health.checkedAt).toLocaleTimeString() })}</span>
            <button className={button} onClick={() => overview.refetch()} disabled={overview.isFetching}>{t("supervision.refresh")}</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t("supervision.localActive")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {health.checks.map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
        </div>
        {version && (
          <p className="mt-3 break-words text-xs text-slate-500" data-testid="version-line">
            {t("supervision.versionLine", {
              version: String(version.details.version ?? "?"),
              commit: String(version.details.commit ?? "?"),
              start: version.details.startedAt ? new Date(String(version.details.startedAt)).toLocaleString() : "?",
              backup: version.details.lastBackupAt ? new Date(String(version.details.lastBackupAt)).toLocaleString() : t("supervision.noBackup"),
            })}
          </p>
        )}
      </section>

      {uptime && (
        <section className={card} data-testid="uptime-section">
          <h2 className="text-sm font-semibold text-white">{t("supervision.uptime.title")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {uptime.last30d.measuredSince
              ? t("supervision.uptime.since", { date: new Date(uptime.last30d.measuredSince).toLocaleString() })
              : t("supervision.uptime.none")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["last24h", "last7d", "last30d"] as const).map((key) => {
              const w = uptime[key];
              return (
                <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3" data-testid={`uptime-${key}`}>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{t(`supervision.uptime.${key}`)}</p>
                  <p className="mt-1 text-xl font-semibold text-white">{w.availablePercent === null ? "—" : `${w.availablePercent} %`}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {w.availablePercent === null ? t("supervision.uptime.waiting") : t("supervision.uptime.detail", { down: w.downMinutes, outages: w.outages })}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-600">{t("supervision.uptime.hint")}</p>
        </section>
      )}

      {stats && (
        <section className={card}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              ["open", stats.open],
              ["last24h", stats.last24h],
              ["occurrences24h", stats.occurrences24h],
              ["total", stats.total],
            ] as const).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{t(`supervision.stats.${key}`)}</p>
                <p className="mt-1 text-xl font-semibold text-white" data-testid={`stat-${key}`}>{value}</p>
              </div>
            ))}
          </div>
          {stats.top.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-[0.15em] text-slate-500">{t("supervision.stats.top")}</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {stats.top.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{item.message}</span>
                    <span className="shrink-0 text-slate-500">×{item.occurrences}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className={card}>
        <h2 className="text-sm font-semibold text-white">{t("supervision.incidents.title")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select aria-label={t("supervision.filters.period")} className={field} value={filters.period} onChange={(e) => setFilter("period", e.target.value)}>
            {PERIODS.map((p) => <option key={p} value={p}>{t(`supervision.period.${p}`)}</option>)}
          </select>
          <select aria-label={t("supervision.filters.level")} className={field} value={filters.level} onChange={(e) => setFilter("level", e.target.value)}>
            <option value="">{t("supervision.filters.allLevels")}</option>
            {LEVELS.map((l) => <option key={l} value={l}>{t(`supervision.level.${l}`)}</option>)}
          </select>
          <select aria-label={t("supervision.filters.source")} className={field} value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
            <option value="">{t("supervision.filters.allSources")}</option>
            {SOURCES.map((s) => <option key={s} value={s}>{t(`supervision.source.${s}`)}</option>)}
          </select>
          <select aria-label={t("supervision.filters.status")} className={field} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">{t("supervision.filters.allStatuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`supervision.status.${s}`)}</option>)}
          </select>
          <select aria-label={t("supervision.filters.sort")} className={field} value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="lastSeen">{t("supervision.filters.sortRecent")}</option>
            <option value="occurrences">{t("supervision.filters.sortFrequent")}</option>
          </select>
          <input aria-label={t("supervision.filters.search")} className={field} value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder={t("supervision.filters.search")} />
        </div>

        <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800" data-testid="incident-list">
          {items.length === 0 && <p className="p-4 text-sm text-slate-500">{t("supervision.incidents.empty")}</p>}
          {items.map((item) => (
            <div key={item.id}>
              <button className="flex w-full flex-col gap-1 p-3 text-left hover:bg-slate-900/60 sm:flex-row sm:items-center sm:gap-3" onClick={() => setOpenId(openId === item.id ? null : item.id)} aria-expanded={openId === item.id}>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${LEVEL_STYLE[item.level] ?? ""}`}>{t(`supervision.level.${item.level}`)}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{t(`supervision.source.${item.source}`)}</span>
                  <span className="text-[11px] text-slate-500">{t(`supervision.status.${item.status}`)}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{item.message}</span>
                <span className="shrink-0 text-[11px] text-slate-500">×{item.occurrences} · {new Date(item.lastSeen).toLocaleString()}</span>
              </button>
              {openId === item.id && <IncidentDetail id={item.id} canEdit={canEdit} onChanged={refresh} />}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button className={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("supervision.pagination.previous")}</button>
            <span>{t("supervision.pagination.page", { page, pages: incidents.data?.pages ?? 1, total: incidents.data?.total ?? 0 })}</span>
            <button className={button} disabled={page >= (incidents.data?.pages ?? 1)} onClick={() => setPage(page + 1)}>{t("supervision.pagination.next")}</button>
          </div>
          <div className="flex items-center gap-2">
            <button className={button} onClick={() => download("json")}>{t("supervision.export.json")}</button>
            <button className={button} onClick={() => download("csv")}>{t("supervision.export.csv")}</button>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-white">{t("supervision.settings.title")}</h2>
        {!canEdit && <p className="mt-1 text-xs text-amber-300">{t("supervision.settings.superAdminOnly")}</p>}
        <div className="mt-4 text-slate-200">
          <SupervisionSettingsForm
            config={config}
            tone="dark"
            readOnly={!canEdit}
            busy={save.isPending}
            saveLabel={t("supervision.settings.save")}
            onSave={async (payload) => {
              setNotice(null);
              await save.mutateAsync(payload).catch(() => undefined);
            }}
            onTest={async (dsn) => {
              const result = await testSentry(dsn);
              refresh();
              return result;
            }}
            onClear={() => clear.mutate()}
          />
        </div>
      </section>

      {canEdit && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-white">{t("supervision.purge.title")}</h2>
          <p className="mt-1 text-xs text-slate-500">{t("supervision.purge.hint")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-slate-400">
              {t("supervision.purge.olderThan")}
              <input className={field} type="number" min={0} max={3650} value={purge.days} onChange={(e) => setPurge({ ...purge, days: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-slate-300">
              <input type="checkbox" checked={purge.onlyClosed} onChange={(e) => setPurge({ ...purge, onlyClosed: e.target.checked })} />
              {t("supervision.purge.onlyClosed")}
            </label>
            <button
              className={button}
              disabled={purgeMutation.isPending}
              data-testid="purge-button"
              onClick={() => {
                if (window.confirm(t("supervision.purge.confirm", { days: purge.days }))) purgeMutation.mutate();
              }}
            >
              {t("supervision.purge.action")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
