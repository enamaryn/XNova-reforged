"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SUPPORT_STATUSES, supportApi, type AdminSupportReport, type SupportStatus } from "@/lib/api/support";
import { useI18n } from "@/lib/i18n";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

const STATUS_STYLE: Record<SupportStatus, string> = {
  new: "bg-sky-500/15 text-sky-300",
  seen: "bg-amber-500/15 text-amber-300",
  resolved: "bg-emerald-500/15 text-emerald-300",
  ignored: "bg-slate-500/15 text-slate-300",
};

function ReportCard({ report, onChanged }: { report: AdminSupportReport; onChanged: () => Promise<unknown> }) {
  const { t, locale } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: (status: SupportStatus) => supportApi.setStatus(report.id, status),
    onSuccess: onChanged,
    onError: () => setError(t("adminSupport.error")),
  });
  const closed = report.status === "resolved" || report.status === "ignored";
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" data-testid={`support-report-${report.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[report.status]}`} data-testid="support-report-status">
          {t(`support.status${report.status}`)}
        </span>
        <span className="uppercase tracking-wide text-slate-400">{t(`support.kind${report.kind}`)}</span>
        <span className="text-slate-500">{new Date(report.createdAt).toLocaleString(locale)}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-white">{report.subject}</h3>
      <p className="mt-1 text-xs text-slate-400">
        {t("adminSupport.player")} : {report.user.username} · {report.user.email}
      </p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{report.body}</p>
      <p className="mt-2 break-words text-xs text-slate-500">
        {t("adminSupport.context")} : {[report.pagePath, report.appVersion, report.userAgent].filter(Boolean).join(" · ") || "—"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {report.status === "new" ? (
          <button type="button" className={button} disabled={change.isPending} onClick={() => change.mutate("seen")}>
            {t("adminSupport.markSeen")}
          </button>
        ) : null}
        {!closed ? (
          <>
            <button type="button" className={button} disabled={change.isPending} onClick={() => change.mutate("resolved")} data-testid="support-resolve">
              {t("adminSupport.resolve")}
            </button>
            <button type="button" className={button} disabled={change.isPending} onClick={() => change.mutate("ignored")}>
              {t("adminSupport.ignore")}
            </button>
          </>
        ) : (
          <button type="button" className={button} disabled={change.isPending} onClick={() => change.mutate("seen")}>
            {t("adminSupport.reopen")}
          </button>
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </li>
  );
}

/** Console admin : signalements des joueurs (filtre par statut, traitement, pagination). */
export function SupportPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SupportStatus | "all">("new");
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "support", status, page], queryFn: () => supportApi.adminList(status, page) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  return (
    <section className={card} data-testid="support-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{t("adminSupport.title")}</h2>
        <select
          className={field}
          value={status}
          aria-label={t("support.kind")}
          data-testid="support-filter"
          onChange={(event) => {
            setStatus(event.target.value as SupportStatus | "all");
            setPage(1);
          }}
        >
          <option value="all">{t("adminSupport.filterAll")}</option>
          {SUPPORT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`support.status${value}`)}
            </option>
          ))}
        </select>
      </div>

      {query.data && query.data.items.length === 0 ? <p className="mt-4 text-sm text-slate-400">{t("adminSupport.empty")}</p> : null}
      <ul className="mt-4 space-y-3">
        {query.data?.items.map((report) => <ReportCard key={report.id} report={report} onChanged={refresh} />)}
      </ul>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <button type="button" className={button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("adminSupport.prev")}
          </button>
          <span>{t("adminSupport.pageOf", { page, pages })}</span>
          <button type="button" className={button} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t("adminSupport.next")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
