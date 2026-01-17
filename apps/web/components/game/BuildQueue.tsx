'use client';

import { useEffect, useState } from 'react';
import type { BuildQueueItem } from '@/lib/api/buildings';

interface BuildQueueProps {
  queue: BuildQueueItem[];
  onCancel: (queueId: string) => Promise<void>;
}

// Formater le temps restant
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Terminé!';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

function QueueItem({
  item,
  onCancel,
}: {
  item: BuildQueueItem;
  onCancel: (queueId: string) => Promise<void>;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(item.remainingSeconds);
  const [canceling, setCanceling] = useState(false);

  // Countdown timer
  useEffect(() => {
    const endTime = new Date(item.endTime).getTime();

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemainingSeconds(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [item.endTime]);

  const handleCancel = async () => {
    if (canceling) return;
    setCanceling(true);
    try {
      await onCancel(item.id);
    } finally {
      setCanceling(false);
    }
  };

  // Calculer le pourcentage de progression
  const startTime = new Date(item.startTime).getTime();
  const endTime = new Date(item.endTime).getTime();
  const totalDuration = endTime - startTime;
  const elapsed = Date.now() - startTime;
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-slate-900/60 p-4 shadow-[0_0_24px_rgba(2,132,199,0.12)]">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold text-white">{item.buildingName}</h4>
          <span className="text-xs text-slate-500">Niveau {item.targetLevel}</span>
        </div>
        <div className="text-left sm:text-right">
          <div className="font-mono text-lg font-bold text-blue-300">
            {formatTimeRemaining(remainingSeconds)}
          </div>
          <button
            onClick={handleCancel}
            disabled={canceling}
            className="text-[11px] uppercase tracking-[0.18em] text-red-300 hover:text-red-200 transition-colors"
          >
            {canceling ? 'Annulation...' : 'Annuler'}
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs text-slate-500">
        {progress.toFixed(0)}%
      </div>
    </div>
  );
}

export function BuildQueue({ queue, onCancel }: BuildQueueProps) {
  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-center">
        <div className="text-3xl mb-2">🏗️</div>
        <p className="text-slate-300">Aucune construction en cours</p>
        <p className="text-xs text-slate-500 mt-1">
          Sélectionnez un bâtiment pour commencer la construction
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-white">
        🔨 File de construction
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
          {queue.length} en cours
        </span>
      </h3>
      {queue.map((item) => (
        <QueueItem key={item.id} item={item} onCancel={onCancel} />
      ))}
    </div>
  );
}
