"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fleetCommandersApi, type CommanderSkill } from "@/lib/api/fleet-commanders";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

const SKILLS: CommanderSkill[] = ["attack", "defense", "speed", "cargo"];

export default function CommandersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planets = useMemo(() => user?.planets ?? [], [user?.planets]);
  const current = planets.find((p) => p.id === selectedPlanetId) ?? planets[0];
  const [name, setName] = useState("");

  const { data } = useQuery({ queryKey: ["fleet-commanders"], queryFn: fleetCommandersApi.list });
  const onSuccess = (result: Awaited<ReturnType<typeof fleetCommandersApi.list>>) => {
    queryClient.setQueryData(["fleet-commanders"], result);
    queryClient.invalidateQueries({ queryKey: ["resources"] });
  };
  const recruit = useMutation({
    mutationFn: () => fleetCommandersApi.recruit(name.trim(), current!.id),
    onSuccess: (result) => {
      setName("");
      onSuccess(result);
    },
  });
  const spend = useMutation({
    mutationFn: (vars: { id: string; skill: CommanderSkill }) => fleetCommandersApi.spend(vars.id, vars.skill),
    onSuccess,
  });
  const dismiss = useMutation({ mutationFn: (id: string) => fleetCommandersApi.dismiss(id), onSuccess });

  if (!data) return <p className="p-8 text-center text-slate-400">{t("common.loading")}</p>;

  const error = [recruit, spend, dismiss].find((m) => m.isError)?.error;
  const full = data.commanders.length >= data.max;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">⭐ {t("fleetCommanders.kicker")}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t("fleetCommanders.title")}</h1>
        <p className="text-sm text-slate-400">
          {t("fleetCommanders.subtitle", { cost: data.cost, max: data.max })}
        </p>
        {current ? (
          <p className="mt-1 text-xs text-slate-500">{t("fleetCommanders.paidOn", { planet: current.name })}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" data-testid="commanders-error">
          {error instanceof Error ? error.message : t("common.errorUnknown")}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length >= 2) recruit.mutate();
        }}
        data-testid="commander-recruit"
      >
        <label className="flex-1 text-xs text-slate-400">
          {t("fleetCommanders.name")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60"
            data-testid="commander-name"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          disabled={recruit.isPending || full || name.trim().length < 2 || !current}
          data-testid="commander-recruit-button"
        >
          {full ? t("fleetCommanders.full") : t("fleetCommanders.recruit", { cost: data.cost })}
        </button>
      </form>

      {data.commanders.length === 0 ? (
        <p className="text-sm text-slate-400" data-testid="commanders-empty">{t("fleetCommanders.empty")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.commanders.map((commander) => {
            const span = commander.nextLevelExperience
              ? commander.nextLevelExperience - commander.levelStartExperience
              : 1;
            const progress = commander.nextLevelExperience
              ? Math.min(100, Math.round(((commander.experience - commander.levelStartExperience) / span) * 100))
              : 100;
            return (
              <section
                key={commander.id}
                className="space-y-3 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5"
                data-testid={`commander-${commander.name}`}
                data-busy={commander.busy}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-white">{commander.name}</h2>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
                    {t("fleetCommanders.level", { level: commander.level })}
                  </span>
                </div>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {commander.nextLevelExperience
                      ? t("fleetCommanders.xp", { xp: commander.experience, next: commander.nextLevelExperience })
                      : t("fleetCommanders.maxLevel")}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {commander.busy ? t("fleetCommanders.busy") : t("fleetCommanders.idle")} ·{" "}
                  {t("fleetCommanders.points", { points: commander.skillPoints })}
                </p>
                <ul className="space-y-2">
                  {SKILLS.map((skill) => (
                    <li key={skill} className="flex items-center justify-between gap-2 text-sm text-slate-200">
                      <span>
                        {t(`fleetCommanders.skills.${skill}`)} {commander.skills[skill]}/{data.maxSkill}{" "}
                        <span className="text-slate-500">(+{Math.round(commander.bonuses[skill] * 100)} %)</span>
                      </span>
                      <button
                        type="button"
                        className="rounded-lg bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40"
                        disabled={commander.skillPoints < 1 || commander.skills[skill] >= data.maxSkill || spend.isPending}
                        onClick={() => spend.mutate({ id: commander.id, skill })}
                        data-testid={`skill-${commander.name}-${skill}`}
                      >
                        +1
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-40"
                  disabled={commander.busy || dismiss.isPending}
                  onClick={() => dismiss.mutate(commander.id)}
                >
                  {t("fleetCommanders.dismiss")}
                </button>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
