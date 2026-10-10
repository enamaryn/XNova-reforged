'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getGalaxySystem, type GalaxyPosition } from '@/lib/api/galaxy';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { useI18n } from '@/lib/i18n';

export default function GalaxyClient() {

  const [galaxy, setGalaxy] = useState(1);
  const [system, setSystem] = useState(1);
  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const { t } = useI18n();

  const formatActivity = (minutes: number | null | undefined) => {
    if (minutes == null) {
      return null;
    }

    if (minutes <= 0) {
      return t('galaxy.activeNow');
    }

    if (minutes < 60) {
      return `${minutes}m`;
    }

    return `${Math.floor(minutes / 60)}h`;
  };

  useEffect(() => {
    if (!selectedPlanetId && user?.planets?.length) {
      setSelectedPlanetId(user.planets[0].id);
    }
  }, [user, selectedPlanetId, setSelectedPlanetId]);


  const { data, isLoading, error } = useQuery({
    queryKey: ['galaxy', galaxy, system],
    queryFn: () => getGalaxySystem(galaxy, system),
  });

  const slots = useMemo<GalaxyPosition[]>(() => {
    return (
      data?.positions ??
      Array.from({ length: 15 }, (_, index) => ({
        position: index + 1,
        occupied: false,
      }))
    );
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Exploration</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t('galaxy.title')}</h1>
        <p className="text-sm text-slate-400">
          {t('galaxy.subtitle')}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Galaxie
            <input
              type="number"
              min={1}
              value={galaxy}
              onChange={(event) => setGalaxy(Number(event.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60 sm:w-28"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Système
            <input
              type="number"
              min={1}
              value={system}
              onChange={(event) => setSystem(Number(event.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60 sm:w-28"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-2">
          {isLoading && (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
              {t('galaxy.loading')}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {t('common.error')}
            </div>
          )}
          {slots.map((slot) => {
            const activityLabel = slot.occupied ? formatActivity(slot.activityMinutes) : '';

            return (
              <div
                key={slot.position}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {galaxy}:{system}:{slot.position}
                  </span>
                  {slot.occupied ? (
                    <span className="text-slate-200 leading-relaxed">
                      {slot.name} · {slot.owner}
                      {slot.allianceTag && ` · [${slot.allianceTag}]`}
                      {activityLabel && ` · ${t('galaxy.activity')} ${activityLabel}`}
                      {slot.hasMoon && ` · ${t('galaxy.moon')}`}
                    </span>
                  ) : (
                    <span className="text-slate-400">{t('galaxy.freeSlot')}</span>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 text-xs text-slate-500 md:w-auto md:justify-end">
                  {slot.occupied ? (
                    <>
                      {slot.isOwn ? (
                        <span>{t('common.you')}</span>
                      ) : (
                        <>
                          <Link
                            href={`/fleet?mission=spy&galaxy=${galaxy}&system=${system}&position=${slot.position}`}
                            className="w-full rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 sm:w-auto"
                          >
                            Espionner
                          </Link>
                          <Link
                            href={`/fleet?mission=attack&galaxy=${galaxy}&system=${system}&position=${slot.position}`}
                            className="w-full rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 sm:w-auto"
                          >
                            Attaquer
                          </Link>
                          <Link
                            href={`/fleet?mission=transport&galaxy=${galaxy}&system=${system}&position=${slot.position}`}
                            className="w-full rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 sm:w-auto"
                          >
                            Transporter
                          </Link>
                        </>
                      )}
                    </>
                  ) : (
                    <Link
                      href={`/fleet?mission=colonize&galaxy=${galaxy}&system=${system}&position=${slot.position}`}
                      className="w-full rounded-full border border-emerald-500/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/10 sm:w-auto"
                    >
                      Coloniser
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
