'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGalaxySystem } from '@/lib/api/galaxy';
import { useI18n } from '@/lib/i18n';

export default function GalaxyPage() {
  const [galaxy, setGalaxy] = useState(1);
  const [system, setSystem] = useState(1);
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['galaxy', galaxy, system],
    queryFn: () => getGalaxySystem(galaxy, system),
  });

  const slots = data?.positions ?? Array.from({ length: 15 }, (_, index) => ({
    position: index + 1,
    occupied: false,
  }));

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
              className="mt-2 w-28 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Système
            <input
              type="number"
              min={1}
              value={system}
              onChange={(event) => setSystem(Number(event.target.value))}
              className="mt-2 w-28 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <button
            disabled
            className="rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500"
          >
            {t('galaxy.scanSoon')}
          </button>
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
          {slots.map((slot) => (
            <div
              key={slot.position}
              className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {galaxy}:{system}:{slot.position}
                </span>
                {slot.occupied ? (
                  <span className="text-slate-200">
                    {slot.name} · {slot.owner}
                  </span>
                ) : (
                  <span className="text-slate-400">{t('galaxy.freeSlot')}</span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {slot.occupied ? (slot.isOwn ? t('common.you') : t('common.contact')) : '--'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
