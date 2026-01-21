'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { colonizePlanet, getGalaxySystem, scanPlanet, type GalaxyPosition } from '@/lib/api/galaxy';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export default function GalaxyClient() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  const [galaxy, setGalaxy] = useState(1);
  const [system, setSystem] = useState(1);
  const [scanResults, setScanResults] = useState<Record<string, { metal: number; crystal: number; deuterium: number }>>({});
  const [colonizeTarget, setColonizeTarget] = useState<number | null>(null);
  const [colonizeName, setColonizeName] = useState('Nouvelle colonie');
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

  const originPlanetId = selectedPlanetId || user?.planets?.[0]?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['galaxy', galaxy, system],
    queryFn: () => getGalaxySystem(galaxy, system),
  });

  const scanMutation = useMutation({
    mutationFn: (planetId: string) => scanPlanet(planetId),
    onSuccess: (result) => {
      setScanResults((prev) => ({
        ...prev,
        [result.id]: result.resources,
      }));
    },
  });

  const colonizeMutation = useMutation({
    mutationFn: (position: number) =>
      colonizePlanet({
        originPlanetId: originPlanetId!,
        galaxy,
        system,
        position,
        name: colonizeName,
      }),
    onSuccess: () => {
      setColonizeTarget(null);
      setColonizeName('Nouvelle colonie');
      refetch();
    },
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
          <button
            disabled
            className="w-full rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500 sm:w-auto"
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
                  {slot.occupied && slot.planetId && scanResults[slot.planetId] && (
                    <span className="text-xs text-slate-400">
                      M {scanResults[slot.planetId].metal} • C {scanResults[slot.planetId].crystal} • D {scanResults[slot.planetId].deuterium}
                    </span>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 text-xs text-slate-500 md:w-auto md:justify-end">
                  {slot.occupied ? (
                    <>
                      {slot.isOwn ? (
                        <span>{t('common.you')}</span>
                      ) : (
                        <>
                          <button
                            onClick={() => slot.planetId && scanMutation.mutate(slot.planetId)}
                            className="w-full rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 sm:w-auto"
                          >
                            Espionner
                          </button>
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
                    <>
                      {colonizeTarget === slot.position ? (
                        <div className="flex w-full flex-wrap items-center gap-2">
                          <input
                            value={colonizeName}
                            onChange={(event) => setColonizeName(event.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-white sm:w-32"
                          />
                          <button
                            onClick={() => colonizeMutation.mutate(slot.position)}
                            disabled={!originPlanetId || colonizeMutation.isPending}
                            className="w-full rounded-full border border-blue-500/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/10 sm:w-auto"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setColonizeTarget(null)}
                            className="w-full rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400 sm:w-auto"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setColonizeTarget(slot.position)}
                          disabled={!originPlanetId}
                          className="w-full rounded-full border border-emerald-500/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/10 sm:w-auto"
                        >
                          Coloniser
                        </button>
                      )}
                    </>
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
