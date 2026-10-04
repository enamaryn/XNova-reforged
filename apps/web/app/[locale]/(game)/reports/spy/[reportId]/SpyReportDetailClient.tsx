"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DEFENSES, SHIPS, TECHNOLOGIES } from "@xnova/game-config";
import { getSpyReport } from "@/lib/api/fleet";

const BUILDING_LABELS: Record<string, string> = {
  metalMine: "Mine de métal",
  crystalMine: "Mine de cristal",
  deuteriumMine: "Synthétiseur de deutérium",
  solarPlant: "Centrale solaire",
  fusionPlant: "Centrale à fusion",
  roboticsFactory: "Usine de robots",
  naniteFactory: "Usine de nanites",
  shipyard: "Chantier spatial",
  metalStorage: "Hangar de métal",
  crystalStorage: "Hangar de cristal",
  deuteriumStorage: "Réservoir de deutérium",
  researchLab: "Laboratoire de recherche",
  terraformer: "Terraformeur",
  allianceDepot: "Dépôt de l'alliance",
  missileSilo: "Silo à missiles",
  moonBase: "Base lunaire",
  phalanx: "Phalange",
  jumpGate: "Porte de saut",
};

export function SpyReportDetailClient({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["spy-report", reportId],
    queryFn: () => getSpyReport(reportId),
  });

  if (isLoading) {
    return <p className="text-slate-400">Chargement du rapport...</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
          Rapport introuvable.
        </div>
        <Link href="/reports" className="text-sm text-blue-300 hover:text-blue-200">
          Retour aux rapports
        </Link>
      </div>
    );
  }

  const { resources, ships, defenses, buildings, technologies } = data.data;

  return (
    <div className="space-y-6" data-testid="spy-report-detail">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Rapport d&apos;espionnage</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            {data.planetName} [{data.galaxy}:{data.system}:{data.position}]
          </h1>
          <p className="text-sm text-slate-400">
            {new Date(data.createdAt).toLocaleString()} · {data.probes} sonde(s) · niveau d&apos;information{" "}
            {data.infoLevel + 1}/4
          </p>
        </div>
        <Link
          href="/reports"
          className="rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-white"
        >
          Retour
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">Ressources</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-900/60 px-4 py-3">Métal <span className="float-right font-mono text-amber-300">{resources.metal}</span></div>
          <div className="rounded-xl bg-slate-900/60 px-4 py-3">Cristal <span className="float-right font-mono text-sky-300">{resources.crystal}</span></div>
          <div className="rounded-xl bg-slate-900/60 px-4 py-3">Deutérium <span className="float-right font-mono text-blue-300">{resources.deuterium}</span></div>
        </div>
      </section>

      {ships ? (
        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">Flotte</h2>
          {Object.keys(ships).length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Aucun vaisseau en orbite.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {Object.entries(ships).map(([id, amount]) => (
                <li key={id} className="rounded-xl bg-slate-900/60 px-4 py-2">
                  {SHIPS[Number(id)]?.name ?? `Vaisseau ${id}`}
                  <span className="float-right font-mono">{amount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-xs text-slate-500">Flotte non révélée : envoyez plus de sondes ou améliorez votre technologie Espionnage.</p>
      )}

      {defenses ? (
        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6" data-testid="spy-defenses">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">Défenses</h2>
          {Object.keys(defenses).length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Aucune défense.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {Object.entries(defenses).map(([id, amount]) => (
                <li key={id} className="rounded-xl bg-slate-900/60 px-4 py-2">
                  {DEFENSES[Number(id)]?.name ?? `Défense ${id}`}
                  <span className="float-right font-mono">{amount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {buildings ? (
        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">Bâtiments</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            {Object.entries(buildings)
              .filter(([, level]) => level > 0)
              .map(([field, level]) => (
                <li key={field} className="rounded-xl bg-slate-900/60 px-4 py-2">
                  {BUILDING_LABELS[field] ?? field}
                  <span className="float-right font-mono">{level}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : (
        <p className="text-xs text-slate-500">Bâtiments non révélés.</p>
      )}

      {technologies ? (
        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">Technologies</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            {Object.entries(technologies).map(([id, level]) => (
              <li key={id} className="rounded-xl bg-slate-900/60 px-4 py-2">
                {TECHNOLOGIES[Number(id)]?.name ?? `Technologie ${id}`}
                <span className="float-right font-mono">{level}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-xs text-slate-500">Technologies non révélées.</p>
      )}
    </div>
  );
}
