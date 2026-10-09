"use client";
import { useQuery } from "@tanstack/react-query";
import { getProgression, type Progression } from "@/lib/api/progression";
const count = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
export function ProgressionSummary({
  progression: p,
}: {
  progression: Progression;
}) {
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
      aria-label="Développement et puissance"
      className="rounded-2xl border border-blue-500/30 bg-slate-950/60 p-3 text-sm"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <strong>Commandant : niveau {p.commanderLevel}/100</strong>
        <strong>Puissance : {count(p.power)}</strong>
      </div>
      <div
        role="progressbar"
        aria-label="Progression du commandant"
        aria-valuenow={Math.floor(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="my-2 h-1.5 overflow-hidden rounded bg-slate-800"
      >
        <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-slate-400">
        Développement : {count(p.development)}
        {p.nextLevelDevelopment === null
          ? " · Niveau maximum"
          : ` / ${count(p.nextLevelDevelopment)} pour le niveau suivant`}
      </p>
      <p className="mt-2">
        Par planète : {p.buildingCapacity} bâtiment(s) simultané(s) ·{" "}
        {p.productionCapacity} ligne(s) de production.
      </p>
      <p className="text-xs text-slate-400">
        Les recherches Gestion des chantiers et Production parallèle débloquent
        2 places ; avec le commandant niveau 50, 3 places maximum.
      </p>
      <details className="mt-2 text-xs text-slate-400">
        <summary>Composition de la puissance</summary>
        <p>
          Bâtiments : {count(p.breakdown.buildings)} · Recherches :{" "}
          {count(p.breakdown.research)} · Vaisseaux : {count(p.breakdown.ships)}{" "}
          · Défenses : {count(p.breakdown.defenses)} · Colonies :{" "}
          {count(p.breakdown.colonies)}
        </p>
        <p>
          Le commandant dépend uniquement des bâtiments et des recherches. Les
          stocks et commandes non produites ne comptent pas.
        </p>
      </details>
    </section>
  );
}
export function CommanderSummary({ compact = false }: { compact?: boolean }) {
  const query = useQuery({
    queryKey: ["progression"],
    queryFn: getProgression,
    refetchInterval: 10000,
  });
  if (query.isError)
    return (
      <button onClick={() => query.refetch()} className="text-xs text-red-300">
        Réessayer le chargement du commandant
      </button>
    );
  if (!query.data)
    return (
      <p className="text-xs text-slate-400">Chargement du développement…</p>
    );
  if (compact)
    return (
      <details className="rounded-xl border border-blue-500/30 bg-slate-950/60 p-2 text-xs">
        <summary className="cursor-pointer">
          Commandant : niveau {query.data.commanderLevel}/100 ·{" "}
          {query.data.buildingCapacity} chantiers ·{" "}
          {query.data.productionCapacity} lignes
        </summary>
        <div className="mt-2">
          <ProgressionSummary progression={query.data} />
        </div>
      </details>
    );
  return <ProgressionSummary progression={query.data} />;
}
