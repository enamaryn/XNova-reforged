"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { questsApi, type QuestPeriodView, type QuestRow, type QuestReward } from "@/lib/api/quests";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

function format(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

function countdown(target: string, nowMs: number) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - nowMs) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}j ${hours}h` : `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default function QuestsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planets = useMemo(() => user?.planets ?? [], [user?.planets]);
  const current = planets.find((p) => p.id === selectedPlanetId) ?? planets[0];
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data } = useQuery({ queryKey: ["quests"], queryFn: questsApi.list, refetchInterval: 30000 });
  const claim = useMutation({
    mutationFn: (questId: string) => questsApi.claim(questId, current!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quests"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
  });

  if (!data) return <p className="p-8 text-center text-slate-400">{t("common.loading")}</p>;

  const rewardText = (reward: QuestReward) =>
    (["metal", "crystal", "deuterium"] as const)
      .filter((key) => reward[key] > 0)
      .map((key) => `${format(reward[key])} ${t(`resources.${key}`)}`)
      .join(" · ");

  const questCard = (quest: QuestRow) => {
    const percent = Math.min(100, Math.round((quest.progress / quest.target) * 100));
    return (
      <li
        key={quest.id}
        className="space-y-2 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-sm"
        data-testid={`quest-${quest.id}`}
        data-state={quest.claimed ? "claimed" : quest.claimable ? "claimable" : "open"}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-white">{t(`goals.metric.${quest.metric}`, { target: format(quest.target) })}</p>
            <p className="text-xs text-slate-400">{t("quests.reward", { reward: rewardText(quest.reward) })}</p>
          </div>
          {quest.claimed ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">{t("quests.claimed")}</span>
          ) : (
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
              disabled={!quest.claimable || claim.isPending || !current}
              onClick={() => claim.mutate(quest.id)}
              data-testid={`claim-${quest.id}`}
            >
              {t("quests.claim")}
            </button>
          )}
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-blue-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("quests.progress", { progress: format(quest.progress), target: format(quest.target) })}
          </p>
        </div>
      </li>
    );
  };

  const section = (title: string, view: QuestPeriodView, testId: string) => (
    <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5" data-testid={testId}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-slate-500">{t("quests.resets", { time: countdown(view.resetsAt, nowMs) })}</p>
      </div>
      <ul className="space-y-3">{view.quests.map(questCard)}</ul>
    </section>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">📜 {t("quests.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("quests.title")}</h1>
        <p className="text-sm text-slate-400">
          {t("quests.subtitle", { multiplier: data.rewardMultiplier.toFixed(1), level: data.commanderLevel })}
        </p>
        {current ? <p className="mt-1 text-xs text-slate-500">{t("quests.planet", { planet: current.name })}</p> : null}
      </div>

      {claim.isError ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="quests-error">
          {claim.error instanceof Error ? claim.error.message : t("common.errorUnknown")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {section(t("quests.daily"), data.daily, "quests-daily")}
        {section(t("quests.weekly"), data.weekly, "quests-weekly")}
      </div>
    </div>
  );
}
