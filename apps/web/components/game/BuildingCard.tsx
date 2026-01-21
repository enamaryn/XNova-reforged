'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { BuildingInfo } from '@/lib/api/buildings';

interface BuildingCardProps {
  building: BuildingInfo;
  onBuild: (buildingId: number) => Promise<void>;
  isBuilding: boolean;
}

// Icônes par catégorie
const categoryIcons: Record<string, string> = {
  resource: '⛏️',
  facility: '🏭',
  station: '🏢',
  defense: '🛡️',
  moon: '🌙',
};

// Couleurs par catégorie
const categoryColors: Record<string, string> = {
  resource: 'border-amber-500/40 hover:border-amber-400',
  facility: 'border-blue-500/40 hover:border-blue-400',
  station: 'border-sky-500/40 hover:border-sky-400',
  defense: 'border-red-500/40 hover:border-red-400',
  moon: 'border-slate-400/40 hover:border-slate-300',
};

// Formater le temps (secondes -> format lisible)
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Formater les nombres
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const BuildingCard = memo(function BuildingCard({
  building,
  onBuild,
  isBuilding,
}: BuildingCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    if (!building.canBuild || loading) return;
    setLoading(true);
    try {
      await onBuild(building.id);
    } finally {
      setLoading(false);
    }
  };

  const icon = categoryIcons[building.category] || '🏗️';
  const borderColor = categoryColors[building.category] || 'border-gray-500/50';
  const categoryLabel = getCategoryLabel(building.category);

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border ${borderColor} bg-slate-900/60 p-4 backdrop-blur-sm transition-all duration-200 shadow-[0_0_24px_rgba(15,23,42,0.6)]`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-white">{building.name}</h3>
            <span className="text-xs text-slate-500">{categoryLabel}</span>
          </div>
        </div>
        <div className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1">
          <span className="text-xs font-mono text-slate-200">Niv. {building.currentLevel}</span>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-slate-400 line-clamp-2">{building.description}</p>

      {/* Coûts */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className={`rounded-xl bg-slate-950/40 p-2 ${building.cost.metal > 0 ? '' : 'opacity-50'}`}>
          <div className="text-slate-500">Métal</div>
          <div className={`font-mono font-semibold ${building.canAfford ? 'text-amber-300' : 'text-red-400'}`}>
            {formatNumber(building.cost.metal)}
          </div>
        </div>
        <div className={`rounded-xl bg-slate-950/40 p-2 ${building.cost.crystal > 0 ? '' : 'opacity-50'}`}>
          <div className="text-slate-500">Cristal</div>
          <div className={`font-mono font-semibold ${building.canAfford ? 'text-sky-300' : 'text-red-400'}`}>
            {formatNumber(building.cost.crystal)}
          </div>
        </div>
        <div className={`col-span-2 rounded-xl bg-slate-950/40 p-2 sm:col-span-1 ${building.cost.deuterium > 0 ? '' : 'opacity-50'}`}>
          <div className="text-slate-500">Deutérium</div>
          <div className={`font-mono font-semibold ${building.canAfford ? 'text-blue-300' : 'text-red-400'}`}>
            {formatNumber(building.cost.deuterium)}
          </div>
        </div>
      </div>

      {/* Durée de construction */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">Durée de construction:</span>
        <span className="font-mono text-white">{formatTime(building.buildTime)}</span>
      </div>

      {/* Prérequis manquants */}
      {building.missingRequirements.length > 0 && (
        <div className="mb-3 rounded-xl bg-red-500/10 p-2 text-xs text-red-300">
          <div className="font-semibold mb-1">Prérequis manquants:</div>
          <ul className="list-disc list-inside">
            {building.missingRequirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {building.isMaxLevel && (
        <div className="mb-3 rounded-xl bg-slate-800/70 p-2 text-xs text-slate-300">
          Niveau max atteint
        </div>
      )}

      {/* En construction */}
      {building.inQueue && (
        <div className="mb-3 rounded-xl bg-blue-500/10 p-2 text-center text-sm text-blue-200">
          🔨 En cours de construction...
        </div>
      )}

      {/* Bouton construire */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          onClick={handleBuild}
          disabled={!building.canBuild || loading || isBuilding}
          className={`flex-1 rounded-xl py-2 px-4 text-sm font-semibold transition-all duration-200 ${
            building.canBuild && !loading && !isBuilding
              ? 'bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {loading ? (
            '⏳ Construction...'
          ) : building.inQueue ? (
            '🔨 En file'
          ) : building.isMaxLevel ? (
            '⛔ Niveau max atteint'
          ) : !building.canAfford ? (
            '💰 Ressources insuffisantes'
          ) : building.missingRequirements.length > 0 ? (
            '🔒 Prérequis manquants'
          ) : (
            `🔨 Construire niveau ${building.currentLevel + 1}`
          )}
        </button>
        <Link
          href={`/buildings/${building.id}`}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-center text-xs text-slate-300 transition hover:border-slate-500 hover:text-white sm:w-auto"
        >
          Détails
        </Link>
      </div>
    </motion.div>
  );
});

BuildingCard.displayName = 'BuildingCard';

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    resource: 'Ressource',
    facility: 'Installation',
    station: 'Station',
    defense: 'Défense',
    moon: 'Lunaire',
  };
  return labels[category] || category;
}
