"use client";

import { useQuery } from "@tanstack/react-query";
import { getProgression } from "@/lib/api/progression";

export function CommanderStatus() {
  const query = useQuery({
    queryKey: ["progression"],
    queryFn: getProgression,
    refetchInterval: 10000,
  });

  return (
    <div
      role="group"
      aria-label="Niveau et puissance du commandant"
      aria-busy={query.isPending}
      className="flex h-8 items-center justify-center gap-2 border-t border-slate-800/60 bg-slate-950/90 px-2 text-xs sm:gap-6"
    >
      <span title="Le niveau du commandant dépend des bâtiments et des recherches.">
        Niveau{" "}
        <strong className="tabular-nums text-blue-300">
          {query.data?.commanderLevel ?? "—"}/100
        </strong>
      </span>
      <span title="Puissance actuelle : bâtiments, recherches, vaisseaux, défenses et colonies.">
        Puissance{" "}
        <strong className="tabular-nums text-cyan-300">
          {query.data
            ? new Intl.NumberFormat("fr-FR").format(query.data.power)
            : "—"}
        </strong>
      </span>
      {query.isError && (
        <button
          onClick={() => query.refetch()}
          aria-label="Réessayer le chargement du niveau et de la puissance"
          title="Réessayer le chargement du niveau et de la puissance"
          className="text-red-300"
        >
          ↻
        </button>
      )}
    </div>
  );
}
