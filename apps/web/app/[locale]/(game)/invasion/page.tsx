"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SHIPS } from "@xnova/game-config";
import { INVASION_RESOURCES, invasionsApi, type InvasionBattleRow } from "@/lib/api/invasions";
import { useI18n, useItemText } from "@/lib/i18n";

const card = "space-y-3 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5";

function format(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

export default function InvasionPage() {
  const { t, locale } = useI18n();
  const itemText = useItemText();
  const query = useQuery({ queryKey: ["invasions"], queryFn: invasionsApi.state, refetchInterval: 30000 });
  const state = query.data;
  const invasion = state?.invasion ?? null;
  const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(locale) : "");
  const shipsText = (ships: Record<string, number> | null) =>
    Object.entries(ships ?? {})
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => `${format(amount)} × ${itemText(Number(id), SHIPS[Number(id)]).name}`)
      .join(", ") || "—";
  const lootText = (loot: Record<string, number> | null | undefined) =>
    loot ? INVASION_RESOURCES.filter((r) => loot[r] > 0).map((r) => `${format(loot[r])} ${t(`resources.${r}`)}`).join(", ") || "—" : "—";

  const battleLine = (battle: InvasionBattleRow) => {
    if (battle.source !== "ATTACK") {
      return t(battle.source === "LOOT_FINAL" ? "invasion.lootFinalLine" : "invasion.lootWaveLine", { wave: battle.waveIndex, loot: lootText(battle.loot) });
    }
    return t(battle.cleared ? "invasion.battleCleared" : "invasion.battleLine", {
      wave: battle.waveIndex,
      result: battle.result ? t(`invasion.result.${battle.result}`) : "—",
      damage: format(battle.damage),
      lost: shipsText(battle.attackerLosses),
    });
  };

  return (
    <div className="space-y-6" data-testid="invasion-page">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">🛸 {t("invasion.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("invasion.title")}</h1>
        <p className="text-sm text-slate-400">
          {state ? t("invasion.subtitle", { waves: state.waves, hours: state.durationHours, regen: state.regenPercentPerHour }) : null}
        </p>
      </div>

      {state && !state.enabled ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" data-testid="invasion-disabled">
          {t("invasion.disabled")}
        </p>
      ) : null}

      {invasion ? (
        <section className={card} data-testid="invasion-active">
          <h2 className="text-lg font-semibold text-white">{t(`invasion.names.${invasion.nameId}`)}</h2>
          <p className="text-sm text-slate-300" data-testid="invasion-progress">
            {t("invasion.progress", { current: invasion.currentWave, total: invasion.totalWaves, cleared: invasion.clearedWaves })}
          </p>
          <p className="text-sm text-slate-300" data-testid="invasion-deadline">{t("invasion.deadline", { date: when(invasion.endsAt) })}</p>
          {invasion.wave ? (
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4" data-testid="invasion-wave">
              <p className="text-sm font-medium text-white" data-testid="invasion-location">
                {t("invasion.waveLocation", { wave: invasion.wave.index, galaxy: invasion.galaxy, system: invasion.wave.system, position: invasion.wave.position })}
              </p>
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={Math.round(invasion.wave.health * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-rose-500" style={{ width: `${Math.round(invasion.wave.health * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400" data-testid="invasion-health">{t("invasion.health", { percent: Math.round(invasion.wave.health * 100) })}</p>
              </div>
              <p className="text-xs text-slate-400">{t("invasion.fleet", { ships: shipsText(invasion.wave.ships) })}</p>
              <Link
                href={`/fleet?mission=attack&galaxy=${invasion.galaxy}&system=${invasion.wave.system}&position=${invasion.wave.position}`}
                className="inline-block rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400"
                data-testid="invasion-attack-link"
              >
                {t("invasion.attack")}
              </Link>
            </div>
          ) : null}
          <p className="text-xs text-slate-400">{t("invasion.waveLoot", { loot: lootText(state!.waveLoot) })}</p>
          <p className="text-xs text-slate-400">{t("invasion.finalLoot", { loot: lootText(state!.finalLoot) })}</p>
          {state!.rewardProductionBonus > 0 ? (
            <p className="text-xs text-slate-400">
              {t("invasion.reward", { percent: Math.round(state!.rewardProductionBonus * 1000) / 10, days: state!.rewardDays })}
            </p>
          ) : null}
          {invasion.mine ? (
            <p className="text-sm text-emerald-300" data-testid="invasion-mine">{t("invasion.mine", { damage: format(invasion.mine.damage) })}</p>
          ) : null}
        </section>
      ) : state?.enabled ? (
        <section className={card} data-testid="invasion-waiting">
          <p className="text-sm text-slate-300">{state.nextAuto ? t("invasion.nextAuto", { date: when(state.nextAuto) }) : t("invasion.none")}</p>
        </section>
      ) : null}

      {state?.last && !invasion ? (
        <p className="text-sm text-slate-300" data-testid="invasion-last">
          {t(`invasion.last.${state.last.status}`, { date: when(state.last.finishedAt), wave: state.last.currentWave, total: state.last.totalWaves })}
        </p>
      ) : null}

      {invasion && invasion.top.length > 0 ? (
        <section className={card} data-testid="invasion-top">
          <h2 className="text-lg font-semibold text-white">{t("invasion.topTitle", { count: invasion.participants })}</h2>
          <ol className="space-y-1 text-sm text-slate-200">
            {invasion.top.map((row, index) => (
              <li key={`${row.username}-${index}`}>
                {index + 1}. {row.username} — {t("invasion.topLine", { damage: format(row.damage) })}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {state && state.battles.length > 0 ? (
        <section className={card} data-testid="invasion-battles">
          <h2 className="text-lg font-semibold text-white">{t("invasion.battlesTitle")}</h2>
          <ul className="space-y-2 text-sm text-slate-200">
            {state.battles.map((battle) => (
              <li key={battle.id} data-source={battle.source}>
                <span className="text-xs text-slate-500">{when(battle.createdAt)}</span> · {battleLine(battle)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
