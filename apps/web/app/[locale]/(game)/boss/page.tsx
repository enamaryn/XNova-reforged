"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SHIPS } from "@xnova/game-config";
import { BOSS_RESOURCES, bossApi, type BossBattleRow } from "@/lib/api/boss";
import { useI18n, useItemText } from "@/lib/i18n";

const card = "space-y-3 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5";

function format(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

export default function BossPage() {
  const { t, locale } = useI18n();
  const itemText = useItemText();
  const query = useQuery({ queryKey: ["boss"], queryFn: bossApi.state, refetchInterval: 30000 });
  const state = query.data;
  const boss = state?.boss ?? null;
  const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(locale) : "");
  const shipsText = (ships: Record<string, number> | null) =>
    Object.entries(ships ?? {})
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => `${format(amount)} × ${itemText(Number(id), SHIPS[Number(id)]).name}`)
      .join(", ") || "—";

  const battleLine = (battle: BossBattleRow) => {
    if (battle.source === "LOOT") {
      const loot = battle.loot;
      return t("boss.lootLine", {
        loot: loot ? BOSS_RESOURCES.filter((r) => loot[r] > 0).map((r) => `${format(loot[r])} ${t(`resources.${r}`)}`).join(", ") || "—" : "—",
      });
    }
    return t(battle.killed ? "boss.battleKilled" : "boss.battleLine", {
      source: t(`boss.source.${battle.source}`),
      result: battle.result ? t(`boss.result.${battle.result}`) : "—",
      damage: format(battle.damage),
      lost: shipsText(battle.attackerLosses),
    });
  };

  return (
    <div className="space-y-6" data-testid="boss-page">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">👾 {t("boss.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("boss.title")}</h1>
        <p className="text-sm text-slate-400">
          {state
            ? t("boss.subtitle", { aggro: Math.round(state.aggroChance * 100), regen: state.regenPercentPerHour, days: state.respawnDays })
            : null}
        </p>
      </div>

      {state && !state.enabled ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" data-testid="boss-disabled">
          {t("boss.disabled")}
        </p>
      ) : null}

      {boss ? (
        <section className={card} data-testid="boss-alive">
          <h2 className="text-lg font-semibold text-white">{t(`boss.names.${boss.nameId}`)}</h2>
          <p className="text-sm text-slate-300" data-testid="boss-location">
            {t("boss.location", { galaxy: boss.galaxy, system: boss.system, position: boss.position })}
          </p>
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={Math.round(boss.health * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-rose-500" style={{ width: `${Math.round(boss.health * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-400" data-testid="boss-health">{t("boss.health", { percent: Math.round(boss.health * 100) })}</p>
          </div>
          <p className="text-xs text-slate-400">{t("boss.fleet", { ships: shipsText(boss.ships) })}</p>
          <p className="text-xs text-slate-400">
            {t("boss.lootPool", { loot: BOSS_RESOURCES.filter((r) => state!.loot[r] > 0).map((r) => `${format(state!.loot[r])} ${t(`resources.${r}`)}`).join(", ") })}
          </p>
          <Link
            href={`/fleet?mission=attack&galaxy=${boss.galaxy}&system=${boss.system}&position=${boss.position}`}
            className="inline-block rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400"
            data-testid="boss-attack-link"
          >
            {t("boss.attack")}
          </Link>
          <p className="text-xs text-slate-500">{t("boss.expeditionHint")}</p>
          {boss.mine ? (
            <p className="text-sm text-emerald-300" data-testid="boss-mine">
              {t("boss.mine", { damage: format(boss.mine.damage), battles: boss.mine.battles })}
            </p>
          ) : null}
        </section>
      ) : state?.enabled ? (
        <section className={card} data-testid="boss-waiting">
          <p className="text-sm text-slate-300">
            {state.nextSpawn ? t("boss.nextSpawn", { date: when(state.nextSpawn) }) : t("boss.none")}
          </p>
        </section>
      ) : null}

      {boss && boss.top.length > 0 ? (
        <section className={card} data-testid="boss-top">
          <h2 className="text-lg font-semibold text-white">{t("boss.topTitle")}</h2>
          <ol className="space-y-1 text-sm text-slate-200">
            {boss.top.map((row, index) => (
              <li key={`${row.username}-${index}`}>
                {index + 1}. {row.username} — {t("boss.topLine", { damage: format(row.damage), battles: row.battles })}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {state && state.battles.length > 0 ? (
        <section className={card} data-testid="boss-battles">
          <h2 className="text-lg font-semibold text-white">{t("boss.battlesTitle")}</h2>
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
