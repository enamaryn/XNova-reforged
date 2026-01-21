import Link from 'next/link';
import { memo } from 'react';

interface PlanetSceneProps {
  planetName: string;
  coordinates: string;
  actionHref?: string;
  actionLabel?: string;
}

export const PlanetScene = memo(function PlanetScene({
  planetName,
  coordinates,
  actionHref = '/buildings',
  actionLabel = 'Accéder aux bâtiments',
}: PlanetSceneProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-[0_0_40px_rgba(2,132,199,0.12)] sm:p-6">
      <div className="absolute right-8 top-6 h-10 w-10 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_16px_rgba(251,191,36,0.8)]" />
      <div className="absolute right-5 top-3 h-14 w-14 rounded-full bg-amber-300/10 blur-xl" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Planète active
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{planetName}</h2>
          <p className="mt-1 text-sm text-slate-400">{coordinates}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={actionHref}
            className="rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 transition hover:border-blue-400 hover:text-white"
          >
            {actionLabel}
          </Link>
          <Link
            href="/research"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Accéder aux technologies
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Link
          href={actionHref}
          className="group relative h-28 w-28 self-center sm:h-36 sm:w-36 sm:self-auto"
        >
          <div className="absolute inset-0 rounded-full border border-blue-500/30 blur-md" />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(191,219,254,0.7),rgba(59,130,246,0.35)_55%,rgba(2,6,23,0.9)_100%)] shadow-[0_0_30px_rgba(56,189,248,0.35)] transition group-hover:scale-[1.03]" />
          <div className="absolute -inset-6 rounded-full border border-slate-800/40" />
        </Link>
        <div className="max-w-xs text-sm text-slate-400">
          Cliquez sur la planète pour accéder rapidement aux bâtiments et à la gestion
          stratégique.
        </div>
      </div>
    </div>
  );
});

PlanetScene.displayName = 'PlanetScene';
