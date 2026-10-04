'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { defenseApi, shipyardApi } from '@/lib/api/shipyard';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { ShipyardQueue } from '@/components/game/ShipyardQueue';

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 60) return `${safe}s`;
  if (safe < 3600) return `${Math.floor(safe / 60)}m ${safe % 60}s`;
  return `${Math.floor(safe / 3600)}h ${Math.floor((safe % 3600) / 60)}m ${safe % 60}s`;
}

export default function DefensePage() {
  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const [amounts, setAmounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!selectedPlanetId && user?.planets?.length) {
      setSelectedPlanetId(user.planets[0].id);
    }
  }, [user, selectedPlanetId, setSelectedPlanetId]);

  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['defense', planetId],
    queryFn: () => defenseApi.getDefenses(planetId!),
    enabled: !!planetId,
    refetchInterval: 30000,
  });

  const { data: queueData, refetch: refetchQueue } = useQuery({
    queryKey: ['shipyard-queue', planetId],
    queryFn: () => shipyardApi.getQueue(planetId!),
    enabled: !!planetId,
    refetchInterval: 5000,
  });

  const refreshAll = () => {
    refetch();
    refetchQueue();
  };

  const buildMutation = useMutation({
    mutationFn: ({ defenseId, amount }: { defenseId: number; amount: number }) =>
      defenseApi.startBuild({ planetId: planetId!, defenseId, amount }),
    onSuccess: refreshAll,
  });

  const cancelMutation = useMutation({
    mutationFn: (queueId: string) => shipyardApi.cancelBuild(queueId),
    onSuccess: refreshAll,
  });

  const defenses = data?.defenses ?? [];
  const resources = data?.resources;
  const queue = queueData ?? [];

  if (!planetId || isLoading) {
    return <p className="p-8 text-center text-slate-400">Chargement des défenses...</p>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4 text-red-400">Erreur lors du chargement</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Infrastructure</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Défense</h1>
          <p className="text-sm text-slate-400">
            Les défenses combattent aux côtés de la flotte stationnée ; après un combat, chaque défense
            détruite est réparée avec 70 % de chances.
          </p>
        </div>
        <div className="rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-xs text-slate-400">
          {queue.length} en cours
        </div>
      </div>

      <ShipyardQueue
        queue={queue}
        onCancel={async (queueId) => {
          await cancelMutation.mutateAsync(queueId);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="defense-list">
        {defenses.map((defense) => {
          const amount = defense.singleUnit ? 1 : Math.max(1, Math.floor(amounts[defense.id] || 1));
          const total = {
            metal: defense.cost.metal * amount,
            crystal: defense.cost.crystal * amount,
            deuterium: defense.cost.deuterium * amount,
          };
          const hasResources =
            !!resources &&
            resources.metal >= total.metal &&
            resources.crystal >= total.crystal &&
            resources.deuterium >= total.deuterium;
          const canBuild = defense.canBuild && hasResources;

          return (
            <div
              key={defense.id}
              className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6"
              data-testid={`defense-${defense.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{defense.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{defense.description}</p>
                </div>
                {defense.inQueue > 0 && (
                  <span className="rounded-full border border-blue-400/60 bg-blue-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-blue-200">
                    En file ({defense.inQueue})
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Stock actuel</span>
                  <span className="text-slate-200" data-testid={`defense-amount-${defense.id}`}>
                    {formatNumber(defense.currentAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Attaque / Bouclier / Structure</span>
                  <span className="text-slate-200">
                    {formatNumber(defense.stats.weapon)} / {formatNumber(defense.stats.shield)} /{' '}
                    {formatNumber(defense.stats.hull)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Coût métal</span>
                  <span className="text-slate-200">{formatNumber(total.metal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coût cristal</span>
                  <span className="text-slate-200">{formatNumber(total.crystal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coût deutérium</span>
                  <span className="text-slate-200">{formatNumber(total.deuterium)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temps estimé</span>
                  <span className="text-slate-200">{formatDuration(defense.buildTime * amount)}</span>
                </div>
              </div>

              {defense.missingRequirements.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-400">
                  {defense.missingRequirements.map((req) => (
                    <div key={req}>• {req}</div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  disabled={defense.singleUnit}
                  value={amount}
                  aria-label={`Quantité ${defense.name}`}
                  onChange={(event) => {
                    const value = Math.max(1, Math.floor(Number(event.target.value)) || 1);
                    setAmounts((prev) => ({ ...prev, [defense.id]: value }));
                  }}
                  className="w-24 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60 disabled:opacity-50"
                />
                <button
                  onClick={() => buildMutation.mutate({ defenseId: defense.id, amount })}
                  disabled={!canBuild || buildMutation.isPending}
                  className={`flex-1 rounded-xl py-2 text-xs uppercase tracking-[0.2em] transition ${
                    !canBuild || buildMutation.isPending
                      ? 'border border-slate-800 bg-slate-900/40 text-slate-500'
                      : 'border border-blue-500/60 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20'
                  }`}
                >
                  {buildMutation.isPending ? 'Construction...' : 'Construire'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(buildMutation.error || cancelMutation.error) && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-red-500/90 px-4 py-3 text-white shadow-lg">
          <p className="text-sm">{((buildMutation.error || cancelMutation.error) as Error).message}</p>
        </div>
      )}
    </div>
  );
}
