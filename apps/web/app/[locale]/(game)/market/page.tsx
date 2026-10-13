"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MARKET_REFERENCE_VALUE, normalizeRate, paymentFor, rateBounds, referenceRate } from "@xnova/game-config";
import { MARKET_RESOURCES, marketApi, type MarketOffer, type MarketResource } from "@/lib/api/market";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";

function format(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

export default function MarketPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planets = useMemo(() => user?.planets ?? [], [user?.planets]);
  const current = planets.find((p) => p.id === selectedPlanetId) ?? planets[0];

  const [filterGive, setFilterGive] = useState("");
  const [filterWant, setFilterWant] = useState("");
  const res = (r: string) => t(`resources.${r}`);

  const offersQuery = useQuery({
    queryKey: ["market-offers", filterGive, filterWant],
    queryFn: () => marketApi.offers(filterGive, filterWant),
    refetchInterval: 15000,
  });
  const mineQuery = useQuery({ queryKey: ["market-mine"], queryFn: marketApi.mine, refetchInterval: 15000 });
  const historyQuery = useQuery({
    queryKey: ["market-history", filterGive, filterWant],
    queryFn: () => marketApi.history(filterGive, filterWant),
    enabled: !!filterGive && !!filterWant && filterGive !== filterWant,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["market-offers"] });
    queryClient.invalidateQueries({ queryKey: ["market-mine"] });
    queryClient.invalidateQueries({ queryKey: ["market-history"] });
    queryClient.invalidateQueries({ queryKey: ["resources"] });
  };

  // Formulaire de création
  const [give, setGive] = useState<MarketResource>("metal");
  const [want, setWant] = useState<MarketResource>("crystal");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  // Le taux se pré-remplit à la parité quand la paire change
  useEffect(() => {
    if (give !== want) setRate(String(normalizeRate(referenceRate(give, want))));
  }, [give, want]);
  const bounds = give !== want ? rateBounds(give, want) : null;

  const create = useMutation({
    mutationFn: () =>
      marketApi.create({
        planetId: current!.id,
        give,
        want,
        amount: Math.floor(Number(amount)),
        rate: Number(rate),
        ...(minAmount ? { minAmount: Math.floor(Number(minAmount)) } : {}),
      }),
    onSuccess: () => {
      setAmount("");
      setMinAmount("");
      refresh();
    },
  });

  // Achat : quantité saisie par offre
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [bought, setBought] = useState<string | null>(null);
  const buy = useMutation({
    mutationFn: (offer: MarketOffer) => {
      const quantity = Math.floor(Number(quantities[offer.id] ?? offer.minAmount));
      return marketApi.buy(offer.id, current!.id, quantity);
    },
    onSuccess: (result) => {
      setBought(t("market.bought", { received: format(result.received), give: res(result.give), paid: format(result.paid), want: res(result.want) }));
      refresh();
    },
  });
  const cancel = useMutation({ mutationFn: (id: string) => marketApi.cancel(id), onSuccess: refresh });

  const error = [create, buy, cancel].find((m) => m.isError)?.error;
  const rules = offersQuery.data?.rules ?? mineQuery.data?.rules;

  const offerRow = (offer: MarketOffer) => {
    const quantity = Math.floor(Number(quantities[offer.id] ?? offer.minAmount)) || 0;
    const cost = quantity > 0 ? paymentFor(quantity, offer.rate) : 0;
    return (
      <li
        key={offer.id}
        className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between"
        data-testid={`offer-${offer.id}`}
      >
        <div>
          <p className="font-medium text-white">
            {t("market.offerLine", { remaining: format(offer.remaining), give: res(offer.give), want: res(offer.want) })}
          </p>
          <p className="text-xs text-slate-400">
            {t("market.rateLine", { rate: String(offer.rate), give: res(offer.give), want: res(offer.want) })} ·{" "}
            {offer.mine ? t("market.yours") : t("market.seller", { name: offer.seller ?? "?" })} ·{" "}
            {t("market.expires", { time: new Date(offer.expiresAt).toLocaleString(locale) })}
          </p>
        </div>
        {offer.mine ? (
          <button
            type="button"
            className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-40"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(offer.id)}
            data-testid={`cancel-${offer.id}`}
          >
            {t("market.cancel")}
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <label className="text-xs text-slate-400">
              {t("market.quantity")}
              <input
                type="number"
                min={1}
                max={offer.remaining}
                value={quantities[offer.id] ?? String(offer.minAmount)}
                onChange={(event) => setQuantities((prev) => ({ ...prev, [offer.id]: event.target.value }))}
                className="mt-1 w-28 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-sm text-white outline-hidden"
                data-testid={`quantity-${offer.id}`}
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              disabled={buy.isPending || quantity < 1 || !current}
              onClick={() => buy.mutate(offer)}
              data-testid={`buy-${offer.id}`}
            >
              {t("market.buy", { cost: format(cost), want: res(offer.want) })}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">⚖️ {t("market.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("market.title")}</h1>
        <p className="text-sm text-slate-400">
          {t("market.subtitle", {
            tax: Math.round((rules?.taxRate ?? 0.05) * 1000) / 10,
            hours: rules?.offerHours ?? 24,
            max: rules?.maxActiveOffers ?? 10,
          })}
        </p>
        {current ? <p className="mt-1 text-xs text-slate-500">{t("market.planet", { planet: current.name })}</p> : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="market-error">
          {error instanceof Error ? error.message : t("common.errorUnknown")}
        </p>
      ) : null}
      {bought ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="market-bought">
          {bought}
        </p>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5" data-testid="market-create">
        <h2 className="text-lg font-semibold text-white">{t("market.createTitle")}</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label className="text-xs text-slate-400">
            {t("market.give")}
            <select value={give} onChange={(e) => setGive(e.target.value as MarketResource)} className={inputClass} data-testid="create-give">
              {MARKET_RESOURCES.map((r) => (
                <option key={r} value={r}>{res(r)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            {t("market.want")}
            <select value={want} onChange={(e) => setWant(e.target.value as MarketResource)} className={inputClass} data-testid="create-want">
              {MARKET_RESOURCES.map((r) => (
                <option key={r} value={r}>{res(r)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            {t("market.amount")}
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} data-testid="create-amount" />
          </label>
          <label className="text-xs text-slate-400">
            {t("market.rate")}
            <input type="number" step="0.0001" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} data-testid="create-rate" />
          </label>
          <label className="text-xs text-slate-400">
            {t("market.minAmount")}
            <input type="number" min={1} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputClass} data-testid="create-min" />
          </label>
          <div className="col-span-2 flex flex-col justify-end gap-2 sm:col-span-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {bounds
                ? t("market.rateHint", { min: String(normalizeRate(bounds.min)), max: String(normalizeRate(bounds.max)), want: res(want), give: res(give) })
                : t("market.samePair")}
              {" · "}
              {t("market.values", {
                values: MARKET_RESOURCES.map((r) => `${res(r)} ${MARKET_REFERENCE_VALUE[r]}`).join(" / "),
              })}
            </p>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              disabled={create.isPending || !current || give === want || !(Number(amount) >= 1) || !(Number(rate) > 0)}
              data-testid="create-submit"
            >
              {t("market.publish")}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-white">{t("market.offersTitle")}</h2>
          <div className="flex gap-3">
            <label className="text-xs text-slate-400">
              {t("market.give")}
              <select value={filterGive} onChange={(e) => setFilterGive(e.target.value)} className={inputClass} data-testid="filter-give">
                <option value="">{t("market.all")}</option>
                {MARKET_RESOURCES.map((r) => (
                  <option key={r} value={r}>{res(r)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              {t("market.want")}
              <select value={filterWant} onChange={(e) => setFilterWant(e.target.value)} className={inputClass} data-testid="filter-want">
                <option value="">{t("market.all")}</option>
                {MARKET_RESOURCES.map((r) => (
                  <option key={r} value={r}>{res(r)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {historyQuery.data ? (
          <p className="text-xs text-slate-400" data-testid="market-history">
            {historyQuery.data.lastRate === null
              ? t("market.noHistory")
              : t("market.history", { last: String(historyQuery.data.lastRate), average: String(historyQuery.data.averageRate) })}
          </p>
        ) : null}
        {(offersQuery.data?.offers.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400" data-testid="market-empty">{t("market.empty")}</p>
        ) : (
          <ul className="space-y-3">{offersQuery.data!.offers.map(offerRow)}</ul>
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white">{t("market.mineTitle")}</h2>
        {(mineQuery.data?.offers.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">{t("market.mineEmpty")}</p>
        ) : (
          <ul className="space-y-3" data-testid="market-mine">{mineQuery.data!.offers.map(offerRow)}</ul>
        )}
        {(mineQuery.data?.trades.length ?? 0) > 0 ? (
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("market.tradesTitle")}</h3>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {mineQuery.data!.trades.map((trade) => (
                <li key={trade.id}>
                  {trade.role === "seller"
                    ? t("market.tradeSold", { amount: format(trade.amount), give: res(trade.give), received: format(trade.received), want: res(trade.want) })
                    : t("market.tradeBought", { amount: format(trade.amount), give: res(trade.give), paid: format(trade.payment), want: res(trade.want) })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
