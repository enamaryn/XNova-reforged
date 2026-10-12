"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { officersApi, type OfficerBonusValues } from "@/lib/api/officers";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

/** Ligne de texte d'un bonus : pourcentages pour les fractions, valeurs brutes pour les compteurs. */
const BONUS_KEYS: (keyof OfficerBonusValues)[] = [
  "energy",
  "mineProduction",
  "storage",
  "buildTimeReduction",
  "researchTimeReduction",
  "fleetSpeed",
  "extraBuildSlots",
  "extraExpeditions",
  "espionageLevels",
];
const FRACTIONS = new Set<keyof OfficerBonusValues>([
  "energy",
  "mineProduction",
  "storage",
  "buildTimeReduction",
  "researchTimeReduction",
  "fleetSpeed",
]);

export default function OfficersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planets = useMemo(() => user?.planets ?? [], [user?.planets]);
  const current = planets.find((p) => p.id === selectedPlanetId) ?? planets[0];

  const { data } = useQuery({ queryKey: ["officers"], queryFn: officersApi.list });
  const hire = useMutation({
    mutationFn: (type: string) => officersApi.hire(type, current!.id),
    onSuccess: (result) => {
      queryClient.setQueryData(["officers"], result);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      queryClient.invalidateQueries({ queryKey: ["technologies"] });
    },
  });

  if (!data) return <p className="p-8 text-center text-slate-400">{t("common.loading")}</p>;

  const bonusLines = (bonus: OfficerBonusValues) =>
    BONUS_KEYS.filter((key) => (bonus[key] ?? 0) > 0).map((key) => {
      const value = bonus[key] as number;
      return t(`officers.bonus.${key}`, {
        value: FRACTIONS.has(key) ? `${Math.round(value * 100)} %` : String(value),
      });
    });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">🎖️ {t("officers.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("officers.title")}</h1>
        <p className="text-sm text-slate-400">{t("officers.subtitle", { cost: data.cost })}</p>
        {current ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="officers-planet">
            {t("officers.paidOn", { planet: current.name })}
          </p>
        ) : null}
      </div>

      {hire.isError ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="officers-error">
          {hire.error instanceof Error ? hire.error.message : t("common.errorUnknown")}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.officers.map((officer) => (
          <section
            key={officer.type}
            className="space-y-3 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5"
            data-testid={`officer-${officer.type}`}
            data-hired={officer.hired}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{t(`officers.names.${officer.type}`)}</h2>
              {officer.hired ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  {t("officers.hired")}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-400">{t(`officers.descriptions.${officer.type}`)}</p>
            <ul className="space-y-1 text-sm text-slate-200">
              {bonusLines(officer.bonus).map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            {!officer.hired ? (
              <button
                type="button"
                className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                disabled={hire.isPending || !current}
                onClick={() => hire.mutate(officer.type)}
                data-testid={`hire-${officer.type}`}
              >
                {t("officers.hire", { cost: data.cost })}
              </button>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
