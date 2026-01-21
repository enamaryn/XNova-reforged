'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { shipyardApi } from '@/lib/api/shipyard';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { ShipyardQueue } from '@/components/game/ShipyardQueue';
import { designTokens } from '@/lib/design-tokens';

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  if (safeSeconds < 3600) {
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

export default function ShipyardPage() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const slideUpProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.slideUp;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0 },
  };

  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const [amounts, setAmounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!selectedPlanetId && user?.planets?.length) {
      setSelectedPlanetId(user.planets[0].id);
    }
  }, [user, selectedPlanetId, setSelectedPlanetId]);

  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  const {
    data: shipyardData,
    isLoading,
    error,
    refetch: refetchShipyard,
  } = useQuery({
    queryKey: ['shipyard', planetId],
    queryFn: () => shipyardApi.getShipyard(planetId!),
    enabled: !!planetId,
    refetchInterval: 30000,
  });

  const {
    data: queueData,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['shipyard-queue', planetId],
    queryFn: () => shipyardApi.getQueue(planetId!),
    enabled: !!planetId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!shipyardData?.ships) return;
    setAmounts((prev) => {
      const next = { ...prev };
      shipyardData.ships.forEach((ship) => {
        if (next[ship.id] === undefined) {
          next[ship.id] = 1;
        }
      });
      return next;
    });
  }, [shipyardData]);

  const buildMutation = useMutation({
    mutationFn: ({ shipId, amount }: { shipId: number; amount: number }) =>
      shipyardApi.startBuild({
        planetId: planetId!,
        shipId,
        amount,
      }),
    onSuccess: () => {
      refetchShipyard();
      refetchQueue();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (queueId: string) => shipyardApi.cancelBuild(queueId),
    onSuccess: () => {
      refetchShipyard();
      refetchQueue();
    },
  });

  const ships = shipyardData?.ships ?? [];
  const resources = shipyardData?.resources;
  const queue = queueData ?? [];

  if (!planetId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">🪐</div>
          <p className="text-slate-400">Chargement des planètes...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🚀</div>
          <p className="text-slate-400">Chargement du chantier spatial...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">Erreur lors du chargement</p>
          <button
            onClick={() => refetchShipyard()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={false} {...fadeInProps} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Infrastructure</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Chantier spatial</h1>
          <p className="text-sm text-slate-400">
            Construisez et déployez vos vaisseaux pour dominer la galaxie
          </p>
        </div>
        <div className="rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-xs text-slate-400">
          {queue.length} en cours
        </div>
      </div>

      <motion.div initial={false} {...slideUpProps}>
        <ShipyardQueue
          queue={queue}
          onCancel={async (queueId) => {
            await cancelMutation.mutateAsync(queueId);
          }}
        />
      </motion.div>

      <motion.div
        variants={shouldReduceMotion ? undefined : listVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        animate={shouldReduceMotion ? undefined : 'show'}
        className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {ships.map((ship) => {
          const amount = Math.max(1, Math.floor(amounts[ship.id] || 1));
          const totalCost = {
            metal: ship.cost.metal * amount,
            crystal: ship.cost.crystal * amount,
            deuterium: ship.cost.deuterium * amount,
          };
          const totalTime = ship.buildTime * amount;
          const hasResources =
            resources &&
            resources.metal >= totalCost.metal &&
            resources.crystal >= totalCost.crystal &&
            resources.deuterium >= totalCost.deuterium;
          const canBuild = ship.canBuild && hasResources;

          return (
            <motion.div
              key={ship.id}
              variants={shouldReduceMotion ? undefined : itemVariants}
              className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{ship.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{ship.description}</p>
                </div>
                {ship.inQueue && (
                  <span className="rounded-full border border-blue-400/60 bg-blue-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-blue-200">
                    En file
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Stock actuel</span>
                  <span className="text-slate-200">{formatNumber(ship.currentAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Coût métal</span>
                  <span className="text-slate-200">{formatNumber(totalCost.metal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Coût cristal</span>
                  <span className="text-slate-200">{formatNumber(totalCost.crystal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Coût deutérium</span>
                  <span className="text-slate-200">{formatNumber(totalCost.deuterium)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Temps estimé</span>
                  <span className="text-slate-200">{formatDuration(totalTime)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Durée unitaire</span>
                  <span>{formatDuration(ship.buildTime)}</span>
                </div>
              </div>

              {ship.missingRequirements.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-400">
                  {ship.missingRequirements.map((req) => (
                    <div key={req}>• {req}</div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(event) => {
                    const value = Math.max(1, Math.floor(Number(event.target.value)) || 1);
                    setAmounts((prev) => ({ ...prev, [ship.id]: value }));
                  }}
                  className="w-24 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                />
                <button
                  onClick={() => buildMutation.mutate({ shipId: ship.id, amount })}
                  disabled={!canBuild || buildMutation.isPending}
                  className={`flex-1 rounded-xl py-2 text-xs uppercase tracking-[0.2em] transition ${
                    !canBuild
                      ? 'border border-slate-800 bg-slate-900/40 text-slate-500'
                      : buildMutation.isPending
                        ? 'border border-slate-800 bg-slate-900 text-slate-500'
                        : 'border border-blue-500/60 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20'
                  }`}
                >
                  {buildMutation.isPending ? 'Construction...' : 'Construire'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {(buildMutation.error || cancelMutation.error) && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-red-500/90 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <p className="text-sm">
            {((buildMutation.error || cancelMutation.error) as Error).message}
          </p>
        </div>
      )}
    </motion.div>
  );
}
