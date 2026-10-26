"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SHIPS } from "@xnova/game-config";
import { BOSS_RESOURCES, bossApi, type BossAdmin, type BossConfig } from "@/lib/api/boss";
import { useI18n, useItemText } from "@/lib/i18n";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

/** Réglage en cours d'édition : les nombres restent du texte jusqu'à l'envoi. */
interface Draft {
  enabled: boolean;
  respawnDays: string;
  aggroPercent: string;
  regenPercentPerHour: string;
  ships: Record<string, string>;
  weapon: string;
  shield: string;
  armor: string;
  loot: Record<string, string>;
}

function toDraft(config: BossConfig): Draft {
  return {
    enabled: config.enabled,
    respawnDays: String(config.respawnDays),
    aggroPercent: String(Math.round(config.aggroChance * 1000) / 10),
    regenPercentPerHour: String(config.regenPercentPerHour),
    ships: Object.fromEntries(Object.entries(config.ships).map(([id, count]) => [id, String(count)])),
    weapon: String(config.tech.weapon),
    shield: String(config.tech.shield),
    armor: String(config.tech.armor),
    loot: Object.fromEntries(BOSS_RESOURCES.map((r) => [r, String(config.loot[r])])),
  };
}

function toConfig(draft: Draft): BossConfig {
  return {
    enabled: draft.enabled,
    respawnDays: Number(draft.respawnDays),
    aggroChance: Math.round(Number(draft.aggroPercent) * 10) / 1000,
    regenPercentPerHour: Number(draft.regenPercentPerHour),
    ships: Object.fromEntries(Object.entries(draft.ships).map(([id, count]) => [id, Number(count)])),
    tech: { weapon: Number(draft.weapon), shield: Number(draft.shield), armor: Number(draft.armor) },
    loot: Object.fromEntries(BOSS_RESOURCES.map((r) => [r, Number(draft.loot[r])])) as BossConfig["loot"],
  };
}

export function BossPanel() {
  const { t, locale } = useI18n();
  const itemText = useItemText();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "boss"], queryFn: bossApi.admin });
  // Brouillon modifié par l'administrateur ; tant qu'il est vide, le formulaire reflète le réglage du serveur.
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft = edited ?? (query.data ? toDraft(query.data.config) : null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galaxy, setGalaxy] = useState("");
  const [system, setSystem] = useState("");
  const [toAdd, setToAdd] = useState("");

  const done = (data: BossAdmin, text: string | null) => {
    queryClient.setQueryData(["admin", "boss"], data);
    queryClient.invalidateQueries({ queryKey: ["boss"] });
    setEdited(null);
    setError(null);
    setMessage(text);
  };
  const fail = (e: Error) => {
    setMessage(null);
    setError(e.message);
  };
  const save = useMutation({ mutationFn: () => bossApi.update(toConfig(draft!)), onSuccess: (d) => done(d, t("admin.boss.saved")), onError: fail });
  const reset = useMutation({ mutationFn: bossApi.reset, onSuccess: (d) => done(d, t("admin.boss.saved")), onError: fail });
  const spawn = useMutation({
    mutationFn: () => bossApi.spawn(galaxy && system ? { galaxy: Number(galaxy), system: Number(system) } : undefined),
    onSuccess: (d) => done(d, t("admin.boss.spawned")),
    onError: fail,
  });
  const despawn = useMutation({ mutationFn: bossApi.despawn, onSuccess: (d) => done(d, t("admin.boss.despawned")), onError: fail });

  if (!query.data || !draft) return <p className="text-sm text-slate-400">…</p>;
  const set = (patch: Partial<Draft>) => setEdited({ ...draft, ...patch });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : "—");
  const numberField = (label: string, key: "respawnDays" | "aggroPercent" | "regenPercentPerHour" | "weapon" | "shield" | "armor") => (
    <label className="text-xs text-slate-400">
      {label}
      <input type="number" step="any" value={draft[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} className={`${field} mt-1`} data-testid={`boss-admin-${key}`} />
    </label>
  );
  const available = query.data.sellableShips.filter((ship) => !(String(ship.id) in draft.ships));

  return (
    <div className="space-y-6" data-testid="boss-panel">
      <section className={card}>
        <h2 className="text-lg font-semibold text-white">{t("admin.boss.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("admin.boss.intro")}</p>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200" data-testid="boss-admin-status">
          {query.data.boss ? (
            <>
              <p>
                {t("admin.boss.alive", {
                  name: t(`boss.names.${query.data.boss.nameId}`),
                  galaxy: query.data.boss.galaxy,
                  system: query.data.boss.system,
                  percent: Math.round(query.data.boss.health * 100),
                })}
              </p>
              <button type="button" className={`${button} mt-3`} disabled={despawn.isPending} onClick={() => window.confirm(t("admin.boss.despawnConfirm")) && despawn.mutate()} data-testid="boss-admin-despawn">
                {t("admin.boss.despawn")}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <p>{t("admin.boss.none")}</p>
              <label className="text-xs text-slate-400">
                {t("admin.boss.galaxy")}
                <input type="number" min={1} value={galaxy} onChange={(e) => setGalaxy(e.target.value)} className={`${field} mt-1 w-24`} data-testid="boss-admin-galaxy" />
              </label>
              <label className="text-xs text-slate-400">
                {t("admin.boss.system")}
                <input type="number" min={1} value={system} onChange={(e) => setSystem(e.target.value)} className={`${field} mt-1 w-24`} data-testid="boss-admin-system" />
              </label>
              <button type="button" className={button} disabled={spawn.isPending} onClick={() => spawn.mutate()} data-testid="boss-admin-spawn">
                {t("admin.boss.spawn")}
              </button>
            </div>
          )}
        </div>
        {query.data.history.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-400" data-testid="boss-admin-history">
            {query.data.history.map((row) => (
              <li key={row.id}>{t("admin.boss.historyLine", { name: t(`boss.names.${row.nameId}`), galaxy: row.galaxy, system: row.system, died: when(row.diedAt), respawn: when(row.respawnAt) })}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={card}>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} data-testid="boss-admin-enabled" />
          {t("admin.boss.enabled")}
        </label>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {numberField(t("admin.boss.respawnDays"), "respawnDays")}
          {numberField(t("admin.boss.aggroPercent"), "aggroPercent")}
          {numberField(t("admin.boss.regen"), "regenPercentPerHour")}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-white">{t("admin.boss.techTitle")}</h3>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {numberField(t("admin.boss.weapon"), "weapon")}
          {numberField(t("admin.boss.shield"), "shield")}
          {numberField(t("admin.boss.armor"), "armor")}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-white">{t("admin.boss.lootTitle")}</h3>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {BOSS_RESOURCES.map((r) => (
            <label key={r} className="text-xs text-slate-400">
              {t(`resources.${r}`)}
              <input type="number" step="1" value={draft.loot[r]} onChange={(e) => set({ loot: { ...draft.loot, [r]: e.target.value } })} className={`${field} mt-1`} data-testid={`boss-admin-loot-${r}`} />
            </label>
          ))}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-white">{t("admin.boss.shipsTitle")}</h3>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(draft.ships).map(([id, count]) => (
            <li key={id} className="flex items-center gap-2 text-sm text-slate-200">
              <span className="w-40 truncate">{itemText(Number(id), SHIPS[Number(id)]).name}</span>
              <input type="number" min={1} step="1" value={count} onChange={(e) => set({ ships: { ...draft.ships, [id]: e.target.value } })} className={`${field} w-32`} data-testid={`boss-admin-ship-${id}`} />
              <button
                type="button"
                className={button}
                onClick={() => set({ ships: Object.fromEntries(Object.entries(draft.ships).filter(([key]) => key !== id)) })}
                aria-label={t("admin.boss.removeShip")}
                data-testid={`boss-admin-remove-${id}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {available.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <select value={toAdd} onChange={(e) => setToAdd(e.target.value)} className={`${field} max-w-xs`} data-testid="boss-admin-add-select">
              <option value="">{t("admin.boss.addShip")}</option>
              {available.map((ship) => (
                <option key={ship.id} value={ship.id}>{itemText(ship.id, SHIPS[ship.id]).name}</option>
              ))}
            </select>
            <button
              type="button"
              className={button}
              disabled={!toAdd}
              onClick={() => {
                set({ ships: { ...draft.ships, [toAdd]: "1" } });
                setToAdd("");
              }}
              data-testid="boss-admin-add"
            >
              +
            </button>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">{t("admin.boss.fleetValue", { value: new Intl.NumberFormat(locale).format(Math.round(query.data.fleetValue)) })}</p>

        {error ? <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="boss-admin-error">{error}</p> : null}
        {message ? <p className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="boss-admin-saved">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50" disabled={save.isPending} onClick={() => save.mutate()} data-testid="boss-admin-save">
            {t("admin.boss.save")}
          </button>
          <button type="button" className={button} disabled={reset.isPending} onClick={() => window.confirm(t("admin.boss.resetConfirm")) && reset.mutate()} data-testid="boss-admin-reset">
            {t("admin.boss.reset")}
          </button>
        </div>
      </section>
    </div>
  );
}
