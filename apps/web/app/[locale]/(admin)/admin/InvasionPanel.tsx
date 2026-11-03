"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SHIPS } from "@xnova/game-config";
import { INVASION_RESOURCES, invasionsApi, type InvasionAdmin, type InvasionConfig } from "@/lib/api/invasions";
import { useI18n, useItemText } from "@/lib/i18n";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

type NumberKey =
  | "autoIntervalDays"
  | "waves"
  | "durationHours"
  | "waveGrowth"
  | "regenPercentPerHour"
  | "rewardPercent"
  | "rewardDays"
  | "weapon"
  | "shield"
  | "armor";

/** Réglage en cours d'édition : les nombres restent du texte jusqu'à l'envoi. */
interface Draft {
  enabled: boolean;
  autoIntervalDays: string;
  waves: string;
  durationHours: string;
  waveGrowth: string;
  regenPercentPerHour: string;
  rewardPercent: string;
  rewardDays: string;
  waveShips: Record<string, string>;
  weapon: string;
  shield: string;
  armor: string;
  waveLoot: Record<string, string>;
  finalLoot: Record<string, string>;
}

const lootDraft = (loot: InvasionConfig["waveLoot"]) => Object.fromEntries(INVASION_RESOURCES.map((r) => [r, String(loot[r])]));
const lootConfig = (draft: Record<string, string>) =>
  Object.fromEntries(INVASION_RESOURCES.map((r) => [r, Number(draft[r])])) as InvasionConfig["waveLoot"];

function toDraft(config: InvasionConfig): Draft {
  return {
    enabled: config.enabled,
    autoIntervalDays: String(config.autoIntervalDays),
    waves: String(config.waves),
    durationHours: String(config.durationHours),
    waveGrowth: String(config.waveGrowth),
    regenPercentPerHour: String(config.regenPercentPerHour),
    rewardPercent: String(Math.round(config.rewardProductionBonus * 1000) / 10),
    rewardDays: String(config.rewardDays),
    waveShips: Object.fromEntries(Object.entries(config.waveShips).map(([id, count]) => [id, String(count)])),
    weapon: String(config.tech.weapon),
    shield: String(config.tech.shield),
    armor: String(config.tech.armor),
    waveLoot: lootDraft(config.waveLoot),
    finalLoot: lootDraft(config.finalLoot),
  };
}

function toConfig(draft: Draft): InvasionConfig {
  return {
    enabled: draft.enabled,
    autoIntervalDays: Number(draft.autoIntervalDays),
    waves: Number(draft.waves),
    durationHours: Number(draft.durationHours),
    waveGrowth: Number(draft.waveGrowth),
    regenPercentPerHour: Number(draft.regenPercentPerHour),
    rewardProductionBonus: Math.round(Number(draft.rewardPercent) * 10) / 1000,
    rewardDays: Number(draft.rewardDays),
    waveShips: Object.fromEntries(Object.entries(draft.waveShips).map(([id, count]) => [id, Number(count)])),
    tech: { weapon: Number(draft.weapon), shield: Number(draft.shield), armor: Number(draft.armor) },
    waveLoot: lootConfig(draft.waveLoot),
    finalLoot: lootConfig(draft.finalLoot),
  };
}

export function InvasionPanel() {
  const { t, locale } = useI18n();
  const itemText = useItemText();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "invasions"], queryFn: invasionsApi.admin });
  // Brouillon modifié par l'administrateur ; tant qu'il est vide, le formulaire reflète le réglage du serveur.
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft = edited ?? (query.data ? toDraft(query.data.config) : null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galaxy, setGalaxy] = useState("");
  const [toAdd, setToAdd] = useState("");

  const done = (data: InvasionAdmin, text: string | null) => {
    queryClient.setQueryData(["admin", "invasions"], data);
    queryClient.invalidateQueries({ queryKey: ["invasions"] });
    setEdited(null);
    setError(null);
    setMessage(text);
  };
  const fail = (e: Error) => {
    setMessage(null);
    setError(e.message);
  };
  const save = useMutation({ mutationFn: () => invasionsApi.update(toConfig(draft!)), onSuccess: (d) => done(d, t("admin.invasion.saved")), onError: fail });
  const reset = useMutation({ mutationFn: invasionsApi.reset, onSuccess: (d) => done(d, t("admin.invasion.saved")), onError: fail });
  const start = useMutation({
    mutationFn: () => invasionsApi.start(galaxy ? Number(galaxy) : undefined),
    onSuccess: (d) => done(d, t("admin.invasion.started")),
    onError: fail,
  });
  const cancel = useMutation({ mutationFn: invasionsApi.cancel, onSuccess: (d) => done(d, t("admin.invasion.cancelled")), onError: fail });

  if (!query.data || !draft) return <p className="text-sm text-slate-400">…</p>;
  const set = (patch: Partial<Draft>) => setEdited({ ...draft, ...patch });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : "—");
  const numberField = (label: string, key: NumberKey) => (
    <label className="text-xs text-slate-400">
      {label}
      <input type="number" step="any" value={draft[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} className={`${field} mt-1`} data-testid={`invasion-admin-${key}`} />
    </label>
  );
  const lootFields = (title: string, key: "waveLoot" | "finalLoot") => (
    <>
      <h3 className="mt-5 text-sm font-semibold text-white">{title}</h3>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {INVASION_RESOURCES.map((r) => (
          <label key={r} className="text-xs text-slate-400">
            {t(`resources.${r}`)}
            <input type="number" step="1" value={draft[key][r]} onChange={(e) => set({ [key]: { ...draft[key], [r]: e.target.value } } as Partial<Draft>)} className={`${field} mt-1`} data-testid={`invasion-admin-${key}-${r}`} />
          </label>
        ))}
      </div>
    </>
  );
  const available = query.data.sellableShips.filter((ship) => !(String(ship.id) in draft.waveShips));
  const status = query.data.invasion;

  return (
    <div className="space-y-6" data-testid="invasion-panel">
      <section className={card}>
        <h2 className="text-lg font-semibold text-white">{t("admin.invasion.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("admin.invasion.intro")}</p>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200" data-testid="invasion-admin-status">
          {status ? (
            <>
              <p>
                {t("admin.invasion.active", {
                  name: t(`invasion.names.${status.nameId}`),
                  galaxy: status.galaxy,
                  current: status.currentWave,
                  total: status.totalWaves,
                  date: when(status.endsAt),
                })}
              </p>
              {status.wave ? (
                <p className="mt-1 text-slate-300" data-testid="invasion-admin-wave">
                  {t("admin.invasion.wave", { wave: status.wave.index, system: status.wave.system, percent: Math.round(status.wave.health * 100) })}
                </p>
              ) : null}
              <button type="button" className={`${button} mt-3`} disabled={cancel.isPending} onClick={() => window.confirm(t("admin.invasion.cancelConfirm")) && cancel.mutate()} data-testid="invasion-admin-cancel">
                {t("admin.invasion.cancel")}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <p>{t("admin.invasion.none")}</p>
              <label className="text-xs text-slate-400">
                {t("admin.invasion.galaxy")}
                <input type="number" min={1} value={galaxy} onChange={(e) => setGalaxy(e.target.value)} className={`${field} mt-1 w-24`} data-testid="invasion-admin-galaxy" />
              </label>
              <button type="button" className={button} disabled={start.isPending} onClick={() => start.mutate()} data-testid="invasion-admin-start">
                {t("admin.invasion.start")}
              </button>
            </div>
          )}
        </div>
        {query.data.history.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-400" data-testid="invasion-admin-history">
            {query.data.history.map((row) => (
              <li key={row.id}>
                {t("admin.invasion.historyLine", {
                  name: t(`invasion.names.${row.nameId}`),
                  galaxy: row.galaxy,
                  status: t(`admin.invasion.status.${row.status}`),
                  wave: row.currentWave,
                  total: row.totalWaves,
                  date: when(row.finishedAt),
                })}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={card}>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} data-testid="invasion-admin-enabled" />
          {t("admin.invasion.enabled")}
        </label>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {numberField(t("admin.invasion.waves"), "waves")}
          {numberField(t("admin.invasion.durationHours"), "durationHours")}
          {numberField(t("admin.invasion.autoIntervalDays"), "autoIntervalDays")}
          {numberField(t("admin.invasion.waveGrowth"), "waveGrowth")}
          {numberField(t("admin.invasion.regen"), "regenPercentPerHour")}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-white">{t("admin.invasion.rewardTitle")}</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {numberField(t("admin.invasion.rewardPercent"), "rewardPercent")}
          {numberField(t("admin.invasion.rewardDays"), "rewardDays")}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-white">{t("admin.invasion.techTitle")}</h3>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {numberField(t("admin.invasion.weapon"), "weapon")}
          {numberField(t("admin.invasion.shield"), "shield")}
          {numberField(t("admin.invasion.armor"), "armor")}
        </div>
        {lootFields(t("admin.invasion.waveLootTitle"), "waveLoot")}
        {lootFields(t("admin.invasion.finalLootTitle"), "finalLoot")}
        <h3 className="mt-5 text-sm font-semibold text-white">{t("admin.invasion.shipsTitle")}</h3>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(draft.waveShips).map(([id, count]) => (
            <li key={id} className="flex items-center gap-2 text-sm text-slate-200">
              <span className="w-40 truncate">{itemText(Number(id), SHIPS[Number(id)]).name}</span>
              <input type="number" min={1} step="1" value={count} onChange={(e) => set({ waveShips: { ...draft.waveShips, [id]: e.target.value } })} className={`${field} w-32`} data-testid={`invasion-admin-ship-${id}`} />
              <button
                type="button"
                className={button}
                onClick={() => set({ waveShips: Object.fromEntries(Object.entries(draft.waveShips).filter(([key]) => key !== id)) })}
                aria-label={t("admin.invasion.removeShip")}
                data-testid={`invasion-admin-remove-${id}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {available.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <select value={toAdd} onChange={(e) => setToAdd(e.target.value)} className={`${field} max-w-xs`} data-testid="invasion-admin-add-select">
              <option value="">{t("admin.invasion.addShip")}</option>
              {available.map((ship) => (
                <option key={ship.id} value={ship.id}>{itemText(ship.id, SHIPS[ship.id]).name}</option>
              ))}
            </select>
            <button
              type="button"
              className={button}
              disabled={!toAdd}
              onClick={() => {
                set({ waveShips: { ...draft.waveShips, [toAdd]: "1" } });
                setToAdd("");
              }}
              data-testid="invasion-admin-add"
            >
              +
            </button>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">{t("admin.invasion.waveValue", { value: new Intl.NumberFormat(locale).format(Math.round(query.data.waveValue)) })}</p>

        {error ? <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="invasion-admin-error">{error}</p> : null}
        {message ? <p className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="invasion-admin-saved">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50" disabled={save.isPending} onClick={() => save.mutate()} data-testid="invasion-admin-save">
            {t("admin.invasion.save")}
          </button>
          <button type="button" className={button} disabled={reset.isPending} onClick={() => window.confirm(t("admin.invasion.resetConfirm")) && reset.mutate()} data-testid="invasion-admin-reset">
            {t("admin.invasion.reset")}
          </button>
        </div>
      </section>
    </div>
  );
}
