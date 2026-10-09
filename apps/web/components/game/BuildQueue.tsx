"use client";

import { useEffect, useState } from "react";
import type { BuildQueueItem } from "@/lib/api/buildings";

interface BuildQueueProps {
  queue: BuildQueueItem[];
  onCancel: (queueId: string) => Promise<void>;
}

// Formater le temps restant
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Terminé!";
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
  const [remainingSeconds, setRemainingSeconds] = useState(
    item.remainingSeconds,
  );
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
  const progress =
    totalDuration > 0
      ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
      : 100;

  return (
    <div
      aria-label={`${item.buildingName}, niveau ${item.targetLevel}`}
      className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-slate-900/60 px-3 py-1"
    >
      <div className="flex min-h-11 items-center gap-2">
        <h4
          className="min-w-0 flex-1 truncate text-xs font-semibold text-white sm:text-sm"
          title={item.buildingName}
        >
          {item.buildingName}
        </h4>
        <span className="shrink-0 text-xs text-slate-400">
          Niv. {item.targetLevel}
        </span>
        <span className="shrink-0 font-mono text-xs font-bold text-blue-300">
          {formatTimeRemaining(remainingSeconds)}
        </span>
        <button
          onClick={handleCancel}
          disabled={canceling}
          aria-label={`Annuler ${item.buildingName}`}
          className="min-h-11 shrink-0 px-1 text-xs text-red-300 transition-colors hover:text-red-200 disabled:opacity-50"
        >
          {canceling ? "…" : "Annuler"}
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={`Avancement ${item.buildingName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-slate-800"
      >
        <div
          className="h-full bg-gradient-to-r from-sky-400 to-blue-600 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function BuildQueue({ queue, onCancel }: BuildQueueProps) {
  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-center sm:p-6">
        <div className="hidden text-3xl mb-2 sm:block">🏗️</div>
        <p className="text-slate-300">Aucune construction en cours</p>
        <p className="hidden text-xs text-slate-500 mt-1 sm:block">
          Sélectionnez un bâtiment pour commencer la construction
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 sm:space-y-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:text-lg text-white">
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
