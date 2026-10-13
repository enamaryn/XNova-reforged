"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { worldEventsApi, type WorldEventEffects, type WorldEventTemplateView, type WorldEventView } from "@/lib/api/world-events";
import { worldEventName } from "@/components/game/WorldEventsBanner";
import { useI18n } from "@/lib/i18n";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

const PHASE_STYLE = {
  active: "bg-emerald-500/15 text-emerald-300",
  reminder: "bg-amber-500/15 text-amber-300",
  later: "bg-slate-500/15 text-slate-300",
} as const;

const percent = (value: number) => Math.round(value * 1000) / 10;

function useDate() {
  const { locale } = useI18n();
  return (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function Effects({ effects }: { effects: WorldEventEffects }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap gap-x-3 text-xs text-slate-300">
      {effects.productionBonus > 0 ? <span>{t("worldEvents.admin.effectProduction", { percent: percent(effects.productionBonus) })}</span> : null}
      {effects.marketTaxReduction > 0 ? <span>{t("worldEvents.admin.effectTax", { percent: percent(effects.marketTaxReduction) })}</span> : null}
    </span>
  );
}

function TemplateRow({ template, onChanged }: { template: WorldEventTemplateView; onChanged: () => Promise<unknown> }) {
  const { t } = useI18n();
  const date = useDate();
  const [days, setDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const launch = useMutation({
    mutationFn: () => worldEventsApi.launchTemplate({ templateId: template.id, ...(days ? { days: Number(days) } : {}) }),
    onSuccess: onChanged,
    onError: (e: Error) => setError(e.message),
  });
  // État affiché tout de suite ; la valeur du serveur reprend la main une fois la liste rechargée (ou en cas d'erreur)
  const [optimisticAuto, setOptimisticAuto] = useState<boolean | null>(null);
  const auto = useMutation({
    mutationFn: (value: boolean) => worldEventsApi.setAuto(template.id, value),
    onMutate: (value) => setOptimisticAuto(value),
    onError: (e: Error) => setError(e.message),
    onSettled: async () => {
      await onChanged();
      setOptimisticAuto(null);
    },
  });

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" data-testid={`world-template-${template.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-white">{t(`worldEvents.names.${template.id}`)}</h4>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${PHASE_STYLE[template.phase]}`}>{t(`worldEvents.admin.phase.${template.phase}`)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {t("worldEvents.admin.window", { start: date(template.startsAt), end: date(new Date(new Date(template.endsAt).getTime() - 1).toISOString()) })}
      </p>
      <div className="mt-1">
        <Effects effects={template.effects} />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            checked={optimisticAuto ?? template.auto}
            disabled={auto.isPending}
            onChange={(event) => auto.mutate(event.target.checked)}
            data-testid={`world-auto-${template.id}`}
          />
          {t("worldEvents.admin.auto")}
        </label>
        {template.launched ? (
          <span className="text-xs text-slate-400">{t("worldEvents.admin.launchedThisYear")}</span>
        ) : (
          <>
            <label className="text-xs text-slate-400">
              {t("worldEvents.admin.days")}
              <input
                className={`${field} mt-1 w-24`}
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </label>
            <button className={button} disabled={launch.isPending} onClick={() => launch.mutate()} data-testid={`world-launch-${template.id}`}>
              {launch.isPending ? t("worldEvents.admin.launching") : t("worldEvents.admin.launch")}
            </button>
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{t("worldEvents.admin.autoHint")}</p>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </li>
  );
}

function CustomForm({ onChanged }: { onChanged: () => Promise<unknown> }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", days: "3", production: "", tax: "" });
  const [error, setError] = useState<string | null>(null);
  const launch = useMutation({
    mutationFn: () =>
      worldEventsApi.launchCustom({
        name: form.name.trim(),
        days: Number(form.days),
        ...(form.production ? { productionBonus: Number(form.production) / 100 } : {}),
        ...(form.tax ? { marketTaxReduction: Number(form.tax) / 100 } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setForm({ name: "", days: "3", production: "", tax: "" });
      onChanged();
    },
    onError: (e: Error) => setError(e.message),
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-white">{t("worldEvents.admin.customTitle")}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          {t("worldEvents.admin.customName")}
          <input className={`${field} mt-1`} value={form.name} maxLength={60} onChange={set("name")} data-testid="world-custom-name" />
        </label>
        <label className="text-xs text-slate-400">
          {t("worldEvents.admin.customDays")}
          <input className={`${field} mt-1`} type="number" min={1} max={60} value={form.days} onChange={set("days")} />
        </label>
        <label className="text-xs text-slate-400">
          {t("worldEvents.admin.customProduction")}
          <input className={`${field} mt-1`} type="number" min={0} max={100} value={form.production} onChange={set("production")} data-testid="world-custom-production" />
        </label>
        <label className="text-xs text-slate-400">
          {t("worldEvents.admin.customTax")}
          <input className={`${field} mt-1`} type="number" min={0} max={100} value={form.tax} onChange={set("tax")} />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{t("worldEvents.admin.customHint")}</p>
      <button
        className={`${button} mt-3`}
        disabled={launch.isPending || !form.name.trim() || !form.days || (!form.production && !form.tax)}
        onClick={() => launch.mutate()}
        data-testid="world-custom-launch"
      >
        {launch.isPending ? t("worldEvents.admin.launching") : t("worldEvents.admin.customLaunch")}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function EventLine({ event, onEnd }: { event: WorldEventView; onEnd?: () => void }) {
  const { t } = useI18n();
  const date = useDate();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3" data-testid="world-event-line">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{worldEventName(event, t)}</p>
        <p className="text-xs text-slate-400">
          {t(`worldEvents.admin.status.${event.status}`)} · {event.auto ? t("worldEvents.admin.by.auto") : t("worldEvents.admin.by.manual")} ·{" "}
          {t("worldEvents.admin.ends", { date: date(event.endedAt ?? event.endsAt) })}
        </p>
        <Effects effects={event.effects} />
      </div>
      {onEnd ? (
        <button className={button} onClick={onEnd} data-testid="world-event-end">
          {t("worldEvents.admin.endNow")}
        </button>
      ) : null}
    </li>
  );
}

export function WorldEventsPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "world-events"], queryFn: worldEventsApi.admin });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "world-events"] }),
      queryClient.invalidateQueries({ queryKey: ["world-events", "active"] }),
    ]);
  const end = useMutation({ mutationFn: (id: string) => worldEventsApi.end(id), onSuccess: refresh });

  if (query.isLoading) return <p className="text-sm text-slate-400">{t("worldEvents.admin.loading")}</p>;
  if (query.isError || !query.data) return <p className="text-sm text-red-300">{t("worldEvents.admin.loadError")}</p>;
  const { active, history, templates, reminders } = query.data;

  return (
    <div className="space-y-6" data-testid="world-events-panel">
      <div className={card}>
        <h2 className="text-lg font-semibold text-white">{t("worldEvents.admin.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("worldEvents.admin.intro")}</p>
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${reminders > 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-slate-800 text-slate-400"}`}
          data-testid="world-reminders"
        >
          {reminders > 0 ? t("worldEvents.admin.remindersCount", { count: reminders }) : t("worldEvents.admin.remindersNone")}
        </p>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-white">{t("worldEvents.admin.activeTitle")}</h3>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{t("worldEvents.admin.activeNone")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((event) => (
              <EventLine
                key={event.id}
                event={event}
                onEnd={() => {
                  if (window.confirm(t("worldEvents.admin.confirmEnd"))) end.mutate(event.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-white">{t("worldEvents.admin.calendarTitle")}</h3>
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} onChanged={refresh} />
          ))}
        </ul>
      </div>

      <CustomForm onChanged={refresh} />

      <div className={card}>
        <h3 className="text-sm font-semibold text-white">{t("worldEvents.admin.historyTitle")}</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{t("worldEvents.admin.historyNone")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((event) => (
              <EventLine key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
