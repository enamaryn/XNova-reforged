'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { getActiveFleets, recallFleet } from '@/lib/api/fleet';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

function formatCountdown(dateValue: string | Date | null | undefined, nowMs: number) {
  if (!dateValue) return '--';
  const target = new Date(dateValue).getTime();
  const diffSeconds = Math.max(0, Math.floor((target - nowMs) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function MovementPage() {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState(Date.now());
  const [recallingId, setRecallingId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: activeFleets, isLoading, error } = useQuery({
    queryKey: ['fleet-active'],
    queryFn: () => getActiveFleets(),
    refetchInterval: 10000,
  });

  const recallMutation = useMutation({
    mutationFn: (fleetId: string) => recallFleet(fleetId),
    onMutate: (fleetId) => {
      setRecallingId(fleetId);
    },
    onSettled: () => {
      setRecallingId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-active'] });
    },
  });

  const missionLabels = useMemo<Record<number, string>>(
    () => ({
      1: t('fleet.missions.attack'),
      3: t('fleet.missions.transport'),
      4: t('fleet.missions.deploy'),
      6: t('fleet.missions.spy'),
      7: t('fleet.missions.colonize'),
    }),
    [t],
  );

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      traveling: t('movement.status.traveling'),
      returning: t('movement.status.returning'),
      arrived: t('movement.status.arrived'),
      completed: t('movement.status.completed'),
    }),
    [t],
  );

  const fleets = activeFleets ?? [];

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {t('movement.kicker')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t('movement.title')}</h1>
        <p className="text-sm text-slate-400">{t('movement.subtitle')}</p>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {t('movement.active')}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {t('movement.tracking')}
            </h2>
          </div>
          <div className="text-xs text-slate-500">{t('movement.refresh')}</div>
        </div>

        <motion.div
          variants={shouldReduceMotion ? undefined : listVariants}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          animate={shouldReduceMotion ? undefined : 'show'}
          className="mt-6 space-y-3"
        >
          {isLoading && (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-400">
              {t('common.loading')}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {t('common.error')}
            </div>
          )}

          {!isLoading && !error && fleets.length === 0 && (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-400">
              {t('movement.empty')}
            </div>
          )}

          {!isLoading && !error && fleets.length > 0 &&
            fleets.map((fleet) => {
              const label = missionLabels[fleet.mission] || `Mission ${fleet.mission}`;
              const statusLabel = statusLabels[fleet.status] || fleet.status;
              const isReturning = fleet.status === 'returning';
              const targetTime = isReturning ? fleet.returnTime : fleet.arrivalTime;
              const fleetSize = Object.values(fleet.ships || {}).reduce(
                (sum, value) => sum + Number(value || 0),
                0,
              );

              return (
                <motion.div
                  key={fleet.id}
                  variants={shouldReduceMotion ? undefined : itemVariants}
                  className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {label}
                      </div>
                      <div className="mt-2 text-sm text-slate-300">
                        {fleet.fromGalaxy}:{fleet.fromSystem}:{fleet.fromPosition} →{' '}
                        {fleet.toGalaxy}:{fleet.toSystem}:{fleet.toPosition}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{statusLabel}</div>
                      <div className="mt-1">
                        {isReturning ? t('movement.backIn') : t('movement.arrivalIn')} {' '}
                        {formatCountdown(targetTime, nowMs)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {t('movement.fleetSize')}: {fleetSize}
                    </div>
                    {fleet.status === 'traveling' && (
                      <button
                        onClick={() => recallMutation.mutate(fleet.id)}
                        disabled={recallingId === fleet.id}
                        className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                          recallingId === fleet.id
                            ? 'border border-slate-800 bg-slate-950 text-slate-500'
                            : 'border border-blue-500/60 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20'
                        }`}
                      >
                        {recallingId === fleet.id ? t('movement.recalling') : t('movement.recall')}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
        </motion.div>
      </div>
    </motion.div>
  );
}
