"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SHIPS } from "@xnova/game-config";
import { NPC_RESOURCES, npcTradeApi, type NpcSeason, type NpcTradeConfig } from "@/lib/api/npc-trade";
import { useI18n, useItemText } from "@/lib/i18n";

const card = "rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-6";
const field =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const button = "rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-blue-400/60 disabled:opacity-50";

/** Réglage en cours d'édition : les nombres restent du texte jusqu'à l'envoi. */
interface Draft {
  enabled: boolean;
  spread: string;
  dailyVariation: string;
  exchangeDailyCap: string;
  shipDailyCap: string;
  shipPriceMultiplier: string;
  ships: number[];
  seasons: Record<NpcSeason, { values: Record<string, string>; spreadReduction: string; shipDiscount: string }>;
}

function toDraft(config: NpcTradeConfig): Draft {
  const seasons = {} as Draft["seasons"];
  for (const season of Object.keys(config.seasons) as NpcSeason[]) {
    const s = config.seasons[season];
    seasons[season] = {
      values: Object.fromEntries(NPC_RESOURCES.map((r) => [r, String(s.values[r])])),
      spreadReduction: String(s.spreadReduction),
      shipDiscount: String(s.shipDiscount),
    };
  }
  return {
    enabled: config.enabled,
    spread: String(config.spread),
    dailyVariation: String(config.dailyVariation),
    exchangeDailyCap: String(config.exchangeDailyCap),
    shipDailyCap: String(config.shipDailyCap),
    shipPriceMultiplier: String(config.shipPriceMultiplier),
    ships: config.ships,
    seasons,
  };
}

function toConfig(draft: Draft): NpcTradeConfig {
  const seasons = {} as NpcTradeConfig["seasons"];
  for (const season of Object.keys(draft.seasons) as NpcSeason[]) {
    const s = draft.seasons[season];
    seasons[season] = {
      values: Object.fromEntries(NPC_RESOURCES.map((r) => [r, Number(s.values[r])])) as NpcTradeConfig["seasons"][NpcSeason]["values"],
      spreadReduction: Number(s.spreadReduction),
      shipDiscount: Number(s.shipDiscount),
    };
  }
  return {
    enabled: draft.enabled,
    spread: Number(draft.spread),
    dailyVariation: Number(draft.dailyVariation),
    exchangeDailyCap: Number(draft.exchangeDailyCap),
    shipDailyCap: Number(draft.shipDailyCap),
    shipPriceMultiplier: Number(draft.shipPriceMultiplier),
    ships: draft.ships,
    seasons,
  };
}

export function NpcTradePanel() {
  const { t } = useI18n();
  const itemText = useItemText();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "npc-trade"], queryFn: npcTradeApi.admin });
  // Brouillon modifié par l'administrateur ; tant qu'il est vide, le formulaire reflète le réglage du serveur.
  const [edited, setDraft] = useState<Draft | null>(null);
  const draft = edited ?? (query.data ? toDraft(query.data.config) : null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = (data: Awaited<ReturnType<typeof npcTradeApi.admin>>, saved: boolean) => {
    queryClient.setQueryData(["admin", "npc-trade"], data);
    queryClient.invalidateQueries({ queryKey: ["npc-trade"] });
    setDraft(null);
    setError(null);
    setMessage(saved ? t("admin.npcTrade.saved") : null);
  };
  const save = useMutation({
    mutationFn: () => npcTradeApi.update(toConfig(draft!)),
    onSuccess: (data) => done(data, true),
    onError: (e: Error) => {
      setMessage(null);
      setError(e.message);
    },
  });
  const reset = useMutation({
    mutationFn: npcTradeApi.reset,
    onSuccess: (data) => done(data, true),
    onError: (e: Error) => setError(e.message),
  });

  if (!query.data || !draft) return <p className="text-sm text-slate-400">…</p>;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setSeason = (season: NpcSeason, patch: Partial<Draft["seasons"][NpcSeason]>) =>
    setDraft({ ...draft, seasons: { ...draft.seasons, [season]: { ...draft.seasons[season], ...patch } } });
  const numberField = (label: string, key: "spread" | "dailyVariation" | "exchangeDailyCap" | "shipDailyCap" | "shipPriceMultiplier") => (
    <label className="text-xs text-slate-400">
      {label}
      <input
        type="number"
        step="any"
        value={draft[key]}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)}
        className={`${field} mt-1`}
        data-testid={`npc-admin-${key}`}
      />
    </label>
  );

  return (
    <div className="space-y-6" data-testid="npc-trade-panel">
      <section className={card}>
        <h2 className="text-lg font-semibold text-white">{t("admin.npcTrade.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("admin.npcTrade.intro")}</p>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            data-testid="npc-admin-enabled"
          />
          {t("admin.npcTrade.enabled")}
        </label>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {numberField(t("admin.npcTrade.spread"), "spread")}
          {numberField(t("admin.npcTrade.dailyVariation"), "dailyVariation")}
          {numberField(t("admin.npcTrade.shipPriceMultiplier"), "shipPriceMultiplier")}
          {numberField(t("admin.npcTrade.exchangeDailyCap"), "exchangeDailyCap")}
          {numberField(t("admin.npcTrade.shipDailyCap"), "shipDailyCap")}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-white">{t("admin.npcTrade.ships")}</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.sellableShips.map((ship) => (
            <li key={ship.id}>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.ships.includes(ship.id)}
                  onChange={(e) =>
                    set({ ships: e.target.checked ? [...draft.ships, ship.id].sort((a, b) => a - b) : draft.ships.filter((id) => id !== ship.id) })
                  }
                  data-testid={`npc-admin-ship-${ship.id}`}
                />
                {itemText(ship.id, SHIPS[ship.id]).name}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-white">{t("admin.npcTrade.seasonsTitle")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {query.data.seasons.map((season) => (
            <div key={season} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" data-testid={`npc-admin-season-${season}`}>
              <p className="text-sm font-medium text-white">
                {t(`npcTrade.season.${season}`)}
                {season === query.data.season ? <span className="ml-2 text-xs text-emerald-300">({t("admin.npcTrade.currentSeason")})</span> : null}
              </p>
              <p className="mt-2 text-xs text-slate-400">{t("admin.npcTrade.values")}</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {NPC_RESOURCES.map((r) => (
                  <label key={r} className="text-xs text-slate-400">
                    {t(`resources.${r}`)}
                    <input
                      type="number"
                      step="any"
                      value={draft.seasons[season].values[r]}
                      onChange={(e) => setSeason(season, { values: { ...draft.seasons[season].values, [r]: e.target.value } })}
                      className={`${field} mt-1`}
                      data-testid={`npc-admin-${season}-${r}`}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400">
                  {t("admin.npcTrade.spreadReduction")}
                  <input
                    type="number"
                    step="any"
                    value={draft.seasons[season].spreadReduction}
                    onChange={(e) => setSeason(season, { spreadReduction: e.target.value })}
                    className={`${field} mt-1`}
                    data-testid={`npc-admin-${season}-spreadReduction`}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  {t("admin.npcTrade.shipDiscount")}
                  <input
                    type="number"
                    step="any"
                    value={draft.seasons[season].shipDiscount}
                    onChange={(e) => setSeason(season, { shipDiscount: e.target.value })}
                    className={`${field} mt-1`}
                    data-testid={`npc-admin-${season}-shipDiscount`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="npc-admin-error">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="npc-admin-saved">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          data-testid="npc-admin-save"
        >
          {t("admin.npcTrade.save")}
        </button>
        <button
          type="button"
          className={button}
          disabled={reset.isPending}
          onClick={() => {
            if (window.confirm(t("admin.npcTrade.resetConfirm"))) reset.mutate();
          }}
          data-testid="npc-admin-reset"
        >
          {t("admin.npcTrade.reset")}
        </button>
      </div>
    </div>
  );
}
