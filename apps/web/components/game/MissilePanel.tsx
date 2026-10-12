"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { missilesApi, type MissileStrike } from "@/lib/api/missiles";
import { useI18n } from "@/lib/i18n";

interface MissilePanelProps {
  planetId: string;
  /** Noms des défenses (identifiant → nom), pour lister les cibles et les destructions. */
  defenseNames: Record<number, string>;
}

function countdown(target: string, nowMs: number) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - nowMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function MissilePanel({ planetId, defenseNames }: MissilePanelProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [system, setSystem] = useState("");
  const [position, setPosition] = useState("");
  const [amount, setAmount] = useState("1");
  const [target, setTarget] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data } = useQuery({
    queryKey: ["missiles", planetId],
    queryFn: () => missilesApi.overview(planetId),
    refetchInterval: 10000,
  });

  const launch = useMutation({
    mutationFn: () =>
      missilesApi.launch({
        planetId,
        toGalaxy: data!.galaxy,
        toSystem: Number(system),
        toPosition: Number(position),
        amount: Math.max(1, Math.floor(Number(amount)) || 1),
        ...(target ? { primaryTarget: Number(target) } : {}),
      }),
    onSuccess: () => {
      setNotice(t("missiles.launched"));
      queryClient.invalidateQueries({ queryKey: ["missiles", planetId] });
      queryClient.invalidateQueries({ queryKey: ["defense", planetId] });
    },
    onError: () => setNotice(null),
  });

  if (!data) return null;

  const hasSilo = data.silo.level > 0;
  const canFire = data.interplanetary > 0 && data.range > 0;
  const incomingActive = data.incoming.filter((s) => s.status === "traveling");

  const destroyedText = (strike: MissileStrike) => {
    const result = strike.result;
    if (!result) return null;
    if (result.lost) return t("missiles.lost");
    const parts = Object.entries(result.destroyed ?? {}).map(
      ([id, count]) => `${count} × ${defenseNames[Number(id)] ?? id}`,
    );
    return (
      <>
        <span>
          {t("missiles.result", {
            launched: result.launched,
            intercepted: result.intercepted,
            hits: result.hits,
          })}
        </span>{" "}
        <span>
          {parts.length > 0
            ? t("missiles.destroyed", { list: parts.join(", ") })
            : t("missiles.nothingDestroyed")}
        </span>
      </>
    );
  };

  const strikeRow = (strike: MissileStrike, incoming: boolean) => (
    <li
      key={strike.id}
      className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-300"
      data-testid={`missile-strike-${incoming ? "in" : "out"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {incoming ? strike.from.galaxy : strike.to.galaxy}:{incoming ? strike.from.system : strike.to.system}:
          {incoming ? strike.from.position : strike.to.position} · {strike.missiles} ×{" "}
          {t("missiles.interplanetary")}
        </span>
        <span className="text-slate-500">
          {strike.status === "traveling"
            ? `${t("missiles.arrivalIn")} ${countdown(strike.arrivalTime, nowMs)}`
            : t("missiles.resolved")}
        </span>
      </div>
      {strike.status === "resolved" && (
        <p className="mt-2 text-slate-400">{destroyedText(strike)}</p>
      )}
    </li>
  );

  return (
    <section
      className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6"
      data-testid="missile-panel"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">{t("missiles.title")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("missiles.subtitle")}</p>
      </div>

      {incomingActive.length > 0 && (
        <p
          role="status"
          className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
          data-testid="missile-incoming-warning"
        >
          {t("missiles.incomingWarning")}
        </p>
      )}

      {!hasSilo ? (
        <p className="text-sm text-slate-400" data-testid="missile-no-silo">
          {t("missiles.noSilo")}
        </p>
      ) : (
        <>
          <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <div className="flex justify-between">
              <span>{t("missiles.silo")}</span>
              <span className="text-slate-200">
                {t("missiles.level")} {data.silo.level}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t("missiles.capacity")}</span>
              <span className="text-slate-200" data-testid="missile-capacity">
                {data.silo.stored + data.silo.inQueue} / {data.silo.capacity}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t("missiles.interplanetary")}</span>
              <span className="text-slate-200" data-testid="missile-ipm">
                {data.interplanetary}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t("missiles.interception")}</span>
              <span className="text-slate-200" data-testid="missile-abm">
                {data.interception}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {data.range > 0
              ? t("missiles.range", { count: data.range, galaxy: data.galaxy })
              : t("missiles.noRange")}
          </p>

          <form
            className="space-y-3"
            data-testid="missile-launch-form"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(null);
              launch.mutate();
            }}
          >
            <h3 className="text-sm font-semibold text-white">{t("missiles.launchTitle")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs text-slate-400">
                {t("missiles.galaxy")}
                <input
                  type="number"
                  value={data.galaxy}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white opacity-60"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("missiles.system")}
                <input
                  type="number"
                  min={1}
                  max={499}
                  required
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  data-testid="missile-system"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("missiles.position")}
                <input
                  type="number"
                  min={1}
                  max={15}
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  data-testid="missile-position"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("missiles.amount")}
                <input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="missile-amount"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60"
                />
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              {t("missiles.target")}
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                data-testid="missile-target"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60"
              >
                <option value="">{t("missiles.targetDefault")}</option>
                {data.targets.map((id) => (
                  <option key={id} value={id}>
                    {defenseNames[id] ?? id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!canFire || launch.isPending}
              data-testid="missile-launch"
              className={`w-full rounded-xl py-2 text-xs uppercase tracking-[0.2em] transition ${
                !canFire || launch.isPending
                  ? "border border-slate-800 bg-slate-900/40 text-slate-500"
                  : "border border-red-500/60 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              }`}
            >
              {launch.isPending ? t("missiles.launching") : t("missiles.launch")}
            </button>
            {launch.error && (
              <p role="alert" className="text-xs text-red-300" data-testid="missile-error">
                {(launch.error as Error).message}
              </p>
            )}
            {notice && (
              <p role="status" className="text-xs text-emerald-300" data-testid="missile-notice">
                {notice}
              </p>
            )}
          </form>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {t("missiles.history")} · {t("missiles.outgoing")}
          </h3>
          <ul className="mt-2 space-y-2">
            {data.outgoing.length === 0 && (
              <li className="text-xs text-slate-500">{t("missiles.empty")}</li>
            )}
            {data.outgoing.map((strike) => strikeRow(strike, false))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            {t("missiles.history")} · {t("missiles.incoming")}
          </h3>
          <ul className="mt-2 space-y-2">
            {data.incoming.length === 0 && (
              <li className="text-xs text-slate-500">{t("missiles.empty")}</li>
            )}
            {data.incoming.map((strike) => strikeRow(strike, true))}
          </ul>
        </div>
      </div>
    </section>
  );
}
