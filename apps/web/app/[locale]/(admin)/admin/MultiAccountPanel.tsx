"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { multiAccountApi, type LinkedGroup, type LinkedPair, type MultiAccountConfig, type MultiAccountOverview } from "@/lib/api/multi-account";
import { useI18n } from "@/lib/i18n";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

type Draft = Record<keyof MultiAccountConfig, string | boolean>;

function toDraft(config: MultiAccountConfig): Draft {
  return {
    enforceRegistration: config.enforceRegistration,
    maxAccountsPerIp: String(config.maxAccountsPerIp),
    ipWindowDays: String(config.ipWindowDays),
    blockLinkedTransfers: config.blockLinkedTransfers,
    retentionDays: String(config.retentionDays),
  };
}

function toConfig(draft: Draft): MultiAccountConfig {
  return {
    enforceRegistration: draft.enforceRegistration as boolean,
    maxAccountsPerIp: Number(draft.maxAccountsPerIp),
    ipWindowDays: Number(draft.ipWindowDays),
    blockLinkedTransfers: draft.blockLinkedTransfers as boolean,
    retentionDays: Number(draft.retentionDays),
  };
}

function PairRow({ group, pair, onResult, onError }: { group: LinkedGroup; pair: LinkedPair; onResult: (data: MultiAccountOverview) => void; onError: (message: string) => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const name = (id: string) => group.users.find((user) => user.id === id)?.username ?? id;
  const add = useMutation({
    mutationFn: () => multiAccountApi.addExemption(pair.a, pair.b, reason.trim()),
    onSuccess: (data) => {
      setReason("");
      onResult(data);
    },
    onError: (error: Error) => onError(error.message),
  });
  const remove = useMutation({
    mutationFn: () => multiAccountApi.removeExemption(pair.a, pair.b),
    onSuccess: onResult,
    onError: (error: Error) => onError(error.message),
  });
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm" data-testid={`linked-pair-${pair.a}-${pair.b}`}>
      <p className="font-medium text-white">
        {name(pair.a)} ↔ {name(pair.b)}
        {pair.exempt ? <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">{t("admin.linked.exemptBadge")}</span> : null}
      </p>
      <ul className="mt-1 text-xs text-slate-300">
        {pair.reasons.map((reasonItem) => (
          <li key={`${reasonItem.type}-${reasonItem.value}`}>
            {reasonItem.type === "ip" ? t("admin.linked.reasonIp", { value: reasonItem.value }) : t("admin.linked.reasonEmail", { value: reasonItem.value })}
          </li>
        ))}
      </ul>
      {pair.exempt ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{t("admin.linked.exemptionReason", { reason: pair.exemptionReason ?? "" })}</span>
          <button type="button" className={button} disabled={remove.isPending} onClick={() => remove.mutate()} data-testid={`linked-remove-${pair.a}-${pair.b}`}>
            {t("admin.linked.removeExemption")}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder={t("admin.linked.reasonPlaceholder")}
            className={`${field} max-w-xs`}
            data-testid={`linked-reason-${pair.a}-${pair.b}`}
          />
          <button type="button" className={button} disabled={add.isPending || reason.trim().length < 3} onClick={() => add.mutate()} data-testid={`linked-exempt-${pair.a}-${pair.b}`}>
            {t("admin.linked.exempt")}
          </button>
        </div>
      )}
    </li>
  );
}

export function MultiAccountPanel() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "multi-account"], queryFn: multiAccountApi.overview });
  // Brouillon modifié par l'administrateur ; tant qu'il est vide, le formulaire reflète le réglage du serveur.
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft = edited ?? (query.data ? toDraft(query.data.config) : null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = (data: MultiAccountOverview, saved: boolean) => {
    queryClient.setQueryData(["admin", "multi-account"], data);
    setEdited(null);
    setError(null);
    setMessage(saved ? t("admin.linked.saved") : null);
  };
  const save = useMutation({
    mutationFn: () => multiAccountApi.update(toConfig(draft!)),
    onSuccess: (data) => done(data, true),
    onError: (e: Error) => {
      setMessage(null);
      setError(e.message);
    },
  });
  const reset = useMutation({
    mutationFn: multiAccountApi.reset,
    onSuccess: (data) => done(data, true),
    onError: (e: Error) => setError(e.message),
  });

  if (!query.data || !draft) return <p className="text-sm text-slate-400">…</p>;
  const set = (patch: Partial<Draft>) => setEdited({ ...draft, ...patch });
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const numberField = (label: string, key: "maxAccountsPerIp" | "ipWindowDays" | "retentionDays") => (
    <label className="text-xs text-slate-400">
      {label}
      <input type="number" step="1" min={0} value={draft[key] as string} onChange={(e) => set({ [key]: e.target.value })} className={`${field} mt-1`} data-testid={`linked-config-${key}`} />
    </label>
  );

  return (
    <div className="space-y-6" data-testid="multi-account-panel">
      <section className={card}>
        <h2 className="text-lg font-semibold text-white">{t("admin.linked.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("admin.linked.intro")}</p>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={draft.enforceRegistration as boolean} onChange={(e) => set({ enforceRegistration: e.target.checked })} data-testid="linked-config-enforceRegistration" />
            {t("admin.linked.enforceRegistration")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={draft.blockLinkedTransfers as boolean} onChange={(e) => set({ blockLinkedTransfers: e.target.checked })} data-testid="linked-config-blockLinkedTransfers" />
            {t("admin.linked.blockLinkedTransfers")}
          </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {numberField(t("admin.linked.maxAccountsPerIp"), "maxAccountsPerIp")}
          {numberField(t("admin.linked.ipWindowDays"), "ipWindowDays")}
          {numberField(t("admin.linked.retentionDays"), "retentionDays")}
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("admin.linked.privacy")}</p>
        {error ? <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="linked-error">{error}</p> : null}
        {message ? <p className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="linked-saved">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50" disabled={save.isPending} onClick={() => save.mutate()} data-testid="linked-save">
            {t("admin.linked.save")}
          </button>
          <button
            type="button"
            className={button}
            disabled={reset.isPending}
            onClick={() => {
              if (window.confirm(t("admin.linked.resetConfirm"))) reset.mutate();
            }}
            data-testid="linked-reset"
          >
            {t("admin.linked.reset")}
          </button>
        </div>
      </section>

      <section className={card} data-testid="linked-groups">
        <h2 className="text-lg font-semibold text-white">{t("admin.linked.groupsTitle", { count: query.data.openGroups })}</h2>
        {query.data.groups.length === 0 ? <p className="mt-2 text-sm text-slate-400">{t("admin.linked.noGroups")}</p> : null}
        <ul className="mt-3 space-y-4">
          {query.data.groups.map((group) => (
            <li key={group.users.map((user) => user.id).join("-")} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" data-testid="linked-group" data-open={group.open}>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                {group.users.map((user) => user.username).join(", ")}
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${group.open ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                  {group.open ? t("admin.linked.openBadge") : t("admin.linked.closedBadge")}
                </span>
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-400 sm:grid-cols-2">
                {group.users.map((user) => (
                  <li key={user.id}>
                    {user.username} · {user.email} · {t("admin.linked.created", { date: date(user.createdAt) })} · {t("admin.linked.lastActive", { date: date(user.lastActive) })}
                    {user.bannedUntil ? ` · ${t("admin.linked.banned")}` : ""}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 space-y-2">
                {group.pairs.map((pair) => (
                  <PairRow
                    key={`${pair.a}-${pair.b}`}
                    group={group}
                    pair={pair}
                    onResult={(data) => done(data, false)}
                    onError={(m) => setError(m)}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
