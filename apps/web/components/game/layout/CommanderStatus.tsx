"use client";

import { useQuery } from "@tanstack/react-query";
import { getProgression } from "@/lib/api/progression";
import { useI18n } from "@/lib/i18n";

export function CommanderStatus() {
  const { t, locale } = useI18n();
  const query = useQuery({
    queryKey: ["progression"],
    queryFn: getProgression,
    refetchInterval: 10000,
  });

  return (
    <div
      role="group"
      aria-label={t("commander.groupAria")}
      aria-busy={query.isPending}
      className="flex h-8 items-center justify-center gap-2 border-t border-slate-800/60 bg-slate-950/90 px-2 text-xs sm:gap-6"
    >
      <span title={t("commander.levelTitle")}>
        {t("commander.level")}{" "}
        <strong className="tabular-nums text-blue-300">
          {query.data?.commanderLevel ?? "—"}/100
        </strong>
      </span>
      <span title={t("commander.powerTitle")}>
        {t("commander.power")}{" "}
        <strong className="tabular-nums text-cyan-300">
          {query.data
            ? new Intl.NumberFormat(locale).format(query.data.power)
            : "—"}
        </strong>
      </span>
      {query.isError && (
        <button
          onClick={() => query.refetch()}
          aria-label={t("commander.retryAria")}
          title={t("commander.retryAria")}
          className="text-red-300"
        >
          ↻
        </button>
      )}
    </div>
  );
}
