"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SHIPS } from "@xnova/game-config";
import { NPC_RESOURCES, npcTradeApi, type NpcResource } from "@/lib/api/npc-trade";
import { useI18n, useItemText } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";
const card = "space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5";

function format(value: number, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(digits ? value : Math.floor(value));
}

export default function NpcTradePage() {
  const { t } = useI18n();
  const itemText = useItemText();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planets = useMemo(() => user?.planets ?? [], [user?.planets]);
  const current = planets.find((p) => p.id === selectedPlanetId) ?? planets[0];
  const res = (r: string) => t(`resources.${r}`);

  const stateQuery = useQuery({ queryKey: ["npc-trade"], queryFn: npcTradeApi.state, refetchInterval: 60000 });
  const state = stateQuery.data;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["npc-trade"] });
    queryClient.invalidateQueries({ queryKey: ["resources"] });
  };

  const [give, setGive] = useState<NpcResource>("metal");
  const [want, setWant] = useState<NpcResource>("crystal");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const rate = state?.rates.find((r) => r.give === give && r.want === want)?.rate ?? 0;
  const quantity = Math.floor(Number(amount)) || 0;
  const preview = Math.floor(quantity * rate);

  const exchange = useMutation({
    mutationFn: () => npcTradeApi.exchange({ planetId: current!.id, give, want, amount: quantity }),
    onSuccess: (result) => {
      setMessage(t("npcTrade.done", { given: format(result.given), give: res(result.give), received: format(result.received), want: res(result.want) }));
      setAmount("");
      refresh();
    },
  });

  const [shipAmounts, setShipAmounts] = useState<Record<number, string>>({});
  const buy = useMutation({
    mutationFn: (shipId: number) =>
      npcTradeApi.buyShips({ planetId: current!.id, shipId, amount: Math.floor(Number(shipAmounts[shipId] ?? 1)) || 1 }),
    onSuccess: (result) => {
      setMessage(t("npcTrade.bought", { amount: format(result.amount), ship: itemText(result.shipId, SHIPS[result.shipId]).name }));
      refresh();
    },
  });

  const error = [exchange, buy].find((m) => m.isError)?.error;
  const capLine = (key: "capExchange" | "capShip", cap: { cap: number; used: number }) =>
    t(`npcTrade.${key}`, { used: format(cap.used), cap: format(cap.cap) });

  return (
    <div className="space-y-6" data-testid="npc-trade-page">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">🛸 {t("npcTrade.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("npcTrade.title")}</h1>
        <p className="text-sm text-slate-400">{t("npcTrade.subtitle")}</p>
        {current ? <p className="mt-1 text-xs text-slate-500">{t("npcTrade.planet", { planet: current.name })}</p> : null}
        {state ? (
          <p className="mt-1 text-xs text-slate-400" data-testid="npc-season">
            {t("npcTrade.seasonLine", { season: t(`npcTrade.season.${state.season}`), spread: Math.round(state.spread * 1000) / 10 })}
          </p>
        ) : null}
      </div>

      {state && !state.enabled ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" data-testid="npc-disabled">
          {t("npcTrade.disabled")}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="npc-error">
          {error instanceof Error ? error.message : t("common.errorUnknown")}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="npc-message">
          {message}
        </p>
      ) : null}

      {state ? (
        <section className={card} data-testid="npc-caps">
          <h2 className="text-lg font-semibold text-white">{t("npcTrade.capTitle")}</h2>
          <p className="text-sm text-slate-300">{capLine("capExchange", state.caps.exchange)}</p>
          <p className="text-sm text-slate-300">{capLine("capShip", state.caps.ship)}</p>
        </section>
      ) : null}

      <section className={card} data-testid="npc-exchange">
        <h2 className="text-lg font-semibold text-white">{t("npcTrade.exchangeTitle")}</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            exchange.mutate();
          }}
        >
          <label className="text-xs text-slate-400">
            {t("npcTrade.give")}
            <select value={give} onChange={(e) => setGive(e.target.value as NpcResource)} className={inputClass} data-testid="npc-give">
              {NPC_RESOURCES.map((r) => (
                <option key={r} value={r}>{res(r)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            {t("npcTrade.want")}
            <select value={want} onChange={(e) => setWant(e.target.value as NpcResource)} className={inputClass} data-testid="npc-want">
              {NPC_RESOURCES.map((r) => (
                <option key={r} value={r}>{res(r)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            {t("npcTrade.amount")}
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} data-testid="npc-amount" />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-40"
              disabled={!current || !state?.enabled || give === want || quantity < 1 || preview < 1 || exchange.isPending}
              data-testid="npc-exchange-submit"
            >
              {t("npcTrade.submit")}
            </button>
          </div>
        </form>
        {give !== want && quantity > 0 ? (
          <p className="text-sm text-slate-300" data-testid="npc-preview">
            {t("npcTrade.receive", { received: format(preview), want: res(want), rate: format(rate, 4) })}
          </p>
        ) : null}
      </section>

      {state ? (
        <section className={card} data-testid="npc-rates">
          <h2 className="text-lg font-semibold text-white">{t("npcTrade.ratesTitle")}</h2>
          <ul className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
            {state.rates.map((r) => (
              <li key={`${r.give}-${r.want}`}>{t("npcTrade.rateLine", { give: res(r.give), want: res(r.want), rate: format(r.rate, 4) })}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {state ? (
        <section className={card} data-testid="npc-ships">
          <h2 className="text-lg font-semibold text-white">{t("npcTrade.shipsTitle")}</h2>
          <p className="text-xs text-slate-400">{t("npcTrade.shipsHint", { factor: format(state.shipPriceFactor, 2) })}</p>
          <ul className="space-y-3">
            {state.ships.map((ship) => (
              <li
                key={ship.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`npc-ship-${ship.id}`}
              >
                <div>
                  <p className="font-medium text-white">{itemText(ship.id, SHIPS[ship.id]).name}</p>
                  <p className="text-xs text-slate-400">
                    {t("npcTrade.unitPrice")} : {NPC_RESOURCES.filter((r) => ship.price[r] > 0)
                      .map((r) => `${format(ship.price[r])} ${res(r)}`)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <label className="text-xs text-slate-400">
                    {t("npcTrade.quantity")}
                    <input
                      type="number"
                      min={1}
                      value={shipAmounts[ship.id] ?? "1"}
                      onChange={(e) => setShipAmounts((prev) => ({ ...prev, [ship.id]: e.target.value }))}
                      className="mt-1 w-24 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-sm text-white outline-hidden"
                      data-testid={`npc-ship-amount-${ship.id}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-xl bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400 disabled:opacity-40"
                    disabled={!current || !state.enabled || buy.isPending}
                    onClick={() => {
                      setMessage(null);
                      buy.mutate(ship.id);
                    }}
                    data-testid={`npc-ship-buy-${ship.id}`}
                  >
                    {t("npcTrade.buy")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
