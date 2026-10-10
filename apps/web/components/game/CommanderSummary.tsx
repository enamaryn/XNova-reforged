"use client";
import { useQuery } from "@tanstack/react-query";
import { getProgression, type Progression } from "@/lib/api/progression";
import { useI18n } from "@/lib/i18n";
export function ProgressionSummary({
  progression: p,
}: {
  progression: Progression;
}) {
  const { t, locale } = useI18n();
  const count = (n: number) => new Intl.NumberFormat(locale).format(n);
  const progress =
    p.nextLevelDevelopment === null
      ? 100
      : Math.min(
          100,
          (100 * (p.development - p.levelDevelopment)) /
            (p.nextLevelDevelopment - p.levelDevelopment),
        );
  return (
    <section
      aria-label={t("commander.summaryAria")}
      className="rounded-2xl border border-blue-500/30 bg-slate-950/60 p-3 text-sm"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <strong>{t("commander.levelStrong", { level: p.commanderLevel })}</strong>
        <strong>{t("commander.powerStrong", { power: count(p.power) })}</strong>
      </div>
      <div
        role="progressbar"
        aria-label={t("commander.progressAria")}
        aria-valuenow={Math.floor(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="my-2 h-1.5 overflow-hidden rounded bg-slate-800"
      >
        <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-slate-400">
        {t("commander.development", { value: count(p.development) })}
        {p.nextLevelDevelopment === null
          ? t("commander.maxLevel")
          : t("commander.toNext", { value: count(p.nextLevelDevelopment) })}
      </p>
      <p className="mt-2">
        {t("commander.perPlanet", {
          buildings: p.buildingCapacity,
          lines: p.productionCapacity,
        })}
      </p>
      <p className="text-xs text-slate-400">
        {t("commander.slotsNote")}
      </p>
      <details className="mt-2 text-xs text-slate-400">
        <summary>{t("commander.breakdownTitle")}</summary>
        <p>
          {t("commander.breakdown", {
            buildings: count(p.breakdown.buildings),
            research: count(p.breakdown.research),
            ships: count(p.breakdown.ships),
            defenses: count(p.breakdown.defenses),
            colonies: count(p.breakdown.colonies),
          })}
        </p>
        <p>
          {t("commander.breakdownNote")}
        </p>
      </details>
    </section>
  );
}
export function CommanderSummary({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["progression"],
    queryFn: getProgression,
    refetchInterval: 10000,
  });
  if (query.isError)
    return (
      <button onClick={() => query.refetch()} className="text-xs text-red-300">
        {t("commander.retryLoad")}
      </button>
    );
  if (!query.data)
    return (
      <p className="text-xs text-slate-400">{t("commander.loading")}</p>
    );
  if (compact)
    return (
      <details className="rounded-xl border border-blue-500/30 bg-slate-950/60 p-2 text-xs">
        <summary className="cursor-pointer">
          {t("commander.compactSummary", {
            level: query.data.commanderLevel,
            buildings: query.data.buildingCapacity,
            lines: query.data.productionCapacity,
          })}
        </summary>
        <div className="mt-2">
          <ProgressionSummary progression={query.data} />
        </div>
      </details>
    );
  return <ProgressionSummary progression={query.data} />;
}
