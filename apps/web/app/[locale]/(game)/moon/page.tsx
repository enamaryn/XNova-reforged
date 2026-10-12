"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvailableShips } from "@/lib/api/fleet";
import { moonsApi, type PhalanxResult } from "@/lib/api/moons";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

const MISSION_KEYS: Record<number, string> = {
  1: "attack",
  2: "acs",
  3: "transport",
  4: "deploy",
  6: "spy",
  7: "colonize",
  8: "recycle",
};

function countdown(target: string | null | undefined, nowMs: number) {
  if (!target) return "--";
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - nowMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60";

export default function MoonPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planets = useMemo(() => user?.planets ?? [], [user?.planets]);
  const current = planets.find((p) => p.id === selectedPlanetId) ?? planets[0];
  const moonId = current?.isMoon ? current.id : undefined;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data } = useQuery({
    queryKey: ["moon", moonId],
    queryFn: () => moonsApi.overview(moonId!),
    enabled: !!moonId,
    refetchInterval: 15000,
  });
  const { data: shipsData } = useQuery({
    queryKey: ["fleet-available", moonId],
    queryFn: () => getAvailableShips(moonId!),
    enabled: !!moonId,
  });

  const [scanTarget, setScanTarget] = useState({ system: "", position: "" });
  const [scanResult, setScanResult] = useState<PhalanxResult | null>(null);
  const scan = useMutation({
    mutationFn: () =>
      moonsApi.scan(moonId!, {
        galaxy: data!.phalanx.galaxy,
        system: Number(scanTarget.system),
        position: Number(scanTarget.position),
      }),
    onSuccess: (result) => {
      setScanResult(result);
      queryClient.invalidateQueries({ queryKey: ["moon", moonId] });
    },
  });

  const [destination, setDestination] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [jumped, setJumped] = useState(false);
  const jump = useMutation({
    mutationFn: () =>
      moonsApi.jump(
        moonId!,
        destination,
        Object.fromEntries(
          Object.entries(amounts)
            .map(([id, value]) => [id, Math.floor(Number(value)) || 0] as const)
            .filter(([, amount]) => amount > 0),
        ),
      ),
    onSuccess: () => {
      setJumped(true);
      setAmounts({});
      queryClient.invalidateQueries({ queryKey: ["moon", moonId] });
      queryClient.invalidateQueries({ queryKey: ["fleet-available"] });
    },
    onError: () => setJumped(false),
  });

  if (!moonId) {
    return (
      <p className="p-8 text-center text-slate-400" data-testid="moon-select-hint">
        {t("moonOps.selectMoon")}
      </p>
    );
  }
  if (!data) return <p className="p-8 text-center text-slate-400">{t("common.loading")}</p>;

  const ships = (shipsData?.ships ?? []).filter((s) => s.shipId !== 212 && s.amount > 0);
  const gateReady = !data.jumpGate.readyAt || new Date(data.jumpGate.readyAt).getTime() <= nowMs;
  const directionKey = { outbound: "outbound", inbound: "inbound", returning: "returning" } as const;
  const coords = (c: { galaxy: number; system: number; position: number; moon?: boolean }) =>
    `${c.galaxy}:${c.system}:${c.position}${c.moon ? " 🌙" : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">🌙 {t("moonOps.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("moonOps.title")}</h1>
        <p className="text-sm text-slate-400">{t("moonOps.subtitle")}</p>
      </div>

      <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6" data-testid="phalanx-panel">
        <h2 className="text-lg font-semibold text-white">{t("moonOps.phalanxTitle")}</h2>
        {data.phalanx.level < 1 ? (
          <p className="text-sm text-slate-400" data-testid="phalanx-missing">{t("moonOps.phalanxMissing")}</p>
        ) : (
          <>
            <p className="text-xs text-slate-500" data-testid="phalanx-range">
              {t("moonOps.phalanxRange", {
                level: data.phalanx.level,
                range: data.phalanx.range,
                cost: data.phalanx.cost,
                galaxy: data.phalanx.galaxy,
                system: data.phalanx.system,
              })}
            </p>
            <form
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                setScanResult(null);
                scan.mutate();
              }}
            >
              <label className="text-xs text-slate-400">
                {t("missiles.system")}
                <input type="number" min={1} max={499} required value={scanTarget.system}
                  onChange={(e) => setScanTarget((p) => ({ ...p, system: e.target.value }))}
                  data-testid="phalanx-system" className={inputClass} />
              </label>
              <label className="text-xs text-slate-400">
                {t("missiles.position")}
                <input type="number" min={1} max={15} required value={scanTarget.position}
                  onChange={(e) => setScanTarget((p) => ({ ...p, position: e.target.value }))}
                  data-testid="phalanx-position" className={inputClass} />
              </label>
              <button type="submit" disabled={scan.isPending} data-testid="phalanx-scan"
                className="col-span-2 self-end rounded-xl border border-blue-500/60 bg-blue-500/10 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/20 disabled:opacity-50 sm:col-span-1">
                {scan.isPending ? t("moonOps.scanning") : t("moonOps.scan")}
              </button>
            </form>
            {scan.error && (
              <p role="alert" className="text-xs text-red-300" data-testid="phalanx-error">
                {(scan.error as Error).message}
              </p>
            )}
            {scanResult && (
              <div data-testid="phalanx-result">
                <p className="text-xs text-slate-400">
                  {t("moonOps.scanOf", { coords: coords(scanResult.target) })}
                </p>
                {scanResult.movements.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400" data-testid="phalanx-empty">{t("moonOps.noMovement")}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {scanResult.movements.map((m, index) => (
                      <li key={index} data-testid="phalanx-movement"
                        className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-300">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>
                            {MISSION_KEYS[m.mission] ? t(`fleet.missions.${MISSION_KEYS[m.mission]}`) : `Mission ${m.mission}`}
                            {" · "}
                            {t(`moonOps.direction.${directionKey[m.direction]}`)}
                          </span>
                          <span className="text-slate-500">{countdown(m.time, nowMs)}</span>
                        </div>
                        <div className="mt-1 text-slate-400">
                          {coords(m.from)} → {coords(m.to)} · {t("moonOps.shipsCount", { count: m.ships })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6" data-testid="jumpgate-panel">
        <h2 className="text-lg font-semibold text-white">{t("moonOps.gateTitle")}</h2>
        {data.jumpGate.level < 1 ? (
          <p className="text-sm text-slate-400" data-testid="gate-missing">{t("moonOps.gateMissing")}</p>
        ) : data.jumpGate.destinations.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="gate-no-destination">{t("moonOps.gateNoDestination")}</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setJumped(false);
              jump.mutate();
            }}
          >
            <p className="text-xs text-slate-500" data-testid="gate-state">
              {gateReady
                ? t("moonOps.gateReady", { seconds: data.jumpGate.cooldownSeconds })
                : t("moonOps.gateCharging", { time: countdown(data.jumpGate.readyAt, nowMs) })}
            </p>
            <label className="block text-xs text-slate-400">
              {t("moonOps.destination")}
              <select value={destination} onChange={(e) => setDestination(e.target.value)} required
                data-testid="gate-destination" className={inputClass}>
                <option value="">—</option>
                {data.jumpGate.destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} [{d.galaxy}:{d.system}:{d.position}]
                  </option>
                ))}
              </select>
            </label>
            {ships.length === 0 ? (
              <p className="text-sm text-slate-400">{t("moonOps.noShips")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ships.map((ship) => (
                  <label key={ship.shipId} className="flex items-center justify-between gap-3 text-xs text-slate-300">
                    <span>{ship.name} ({ship.amount})</span>
                    <input type="number" min={0} max={ship.amount} value={amounts[ship.shipId] ?? ""}
                      onChange={(e) => setAmounts((p) => ({ ...p, [ship.shipId]: e.target.value }))}
                      data-testid={`gate-ship-${ship.shipId}`}
                      className="w-24 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1 text-sm text-white" />
                  </label>
                ))}
              </div>
            )}
            <button type="submit" disabled={!gateReady || jump.isPending || !destination} data-testid="gate-jump"
              className="w-full rounded-xl border border-violet-500/60 bg-violet-500/10 py-2 text-xs uppercase tracking-[0.2em] text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">
              {jump.isPending ? t("moonOps.jumping") : t("moonOps.jump")}
            </button>
            {jump.error && (
              <p role="alert" className="text-xs text-red-300" data-testid="gate-error">{(jump.error as Error).message}</p>
            )}
            {jumped && <p role="status" className="text-xs text-emerald-300" data-testid="gate-done">{t("moonOps.jumped")}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
