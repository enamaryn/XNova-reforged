"use client";

import { useQuery } from "@tanstack/react-query";
import { questsApi } from "@/lib/api/quests";
import { useI18n } from "@/lib/i18n";

function format(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

export default function AchievementsPage() {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["achievements"], queryFn: questsApi.achievements });

  if (!data) return <p className="p-8 text-center text-slate-400">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">🏅 {t("achievements.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("achievements.title")}</h1>
        <p className="text-sm text-slate-400" data-testid="achievements-summary">
          {t("achievements.summary", { unlocked: data.unlocked, total: data.total, percent: data.percent })}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-emerald-500" style={{ width: `${data.percent}%` }} />
        </div>
      </div>

      {data.newlyUnlocked.length > 0 ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="achievements-new">
          {t("achievements.newlyUnlocked", { count: data.newlyUnlocked.length })}
        </p>
      ) : null}

      {data.categories.map(({ category, achievements }) => (
        <section key={category} className="space-y-3 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5" data-testid={`category-${category}`}>
          <h2 className="text-lg font-semibold text-white">{t(`achievements.categories.${category}`)}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => (
              <li
                key={achievement.id}
                className={`space-y-2 rounded-2xl border p-4 text-sm ${
                  achievement.unlocked ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800/60 bg-slate-900/50"
                }`}
                data-testid={`achievement-${achievement.id}`}
                data-unlocked={achievement.unlocked}
              >
                <p className={achievement.unlocked ? "font-medium text-emerald-200" : "font-medium text-slate-200"}>
                  {achievement.unlocked ? "✓ " : ""}
                  {t(`goals.metric.${achievement.metric}`, { target: format(achievement.target) })}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={achievement.unlocked ? "h-full bg-emerald-500" : "h-full bg-blue-500"}
                    style={{ width: `${Math.min(100, Math.round((achievement.progress / achievement.target) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {achievement.unlocked && achievement.unlockedAt
                    ? t("achievements.unlockedOn", { date: new Date(achievement.unlockedAt).toLocaleDateString(locale) })
                    : t("quests.progress", { progress: format(achievement.progress), target: format(achievement.target) })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
