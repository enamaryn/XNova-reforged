'use client';

import { useState } from 'react';
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
  resource: 'border-amber-500/50 hover:border-amber-500',
  facility: 'border-blue-500/50 hover:border-blue-500',
  station: 'border-purple-500/50 hover:border-purple-500',
  defense: 'border-red-500/50 hover:border-red-500',
  moon: 'border-gray-400/50 hover:border-gray-400',
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

export function BuildingCard({ building, onBuild, isBuilding }: BuildingCardProps) {
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

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} bg-gray-800/50 p-4 backdrop-blur-sm transition-all duration-200`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-white">{building.name}</h3>
            <span className="text-xs text-gray-400 capitalize">{building.category}</span>
          </div>
        </div>
        <div className="rounded bg-gray-700/50 px-2 py-1">
          <span className="text-sm font-mono text-white">Niv. {building.currentLevel}</span>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-gray-400 line-clamp-2">{building.description}</p>

      {/* Coûts */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <div className={`rounded bg-gray-700/30 p-2 ${building.cost.metal > 0 ? '' : 'opacity-50'}`}>
          <div className="text-gray-400">Métal</div>
          <div className={`font-mono font-semibold ${building.canAfford ? 'text-amber-400' : 'text-red-400'}`}>
            {formatNumber(building.cost.metal)}
          </div>
        </div>
        <div className={`rounded bg-gray-700/30 p-2 ${building.cost.crystal > 0 ? '' : 'opacity-50'}`}>
          <div className="text-gray-400">Cristal</div>
          <div className={`font-mono font-semibold ${building.canAfford ? 'text-cyan-400' : 'text-red-400'}`}>
            {formatNumber(building.cost.crystal)}
          </div>
        </div>
        <div className={`rounded bg-gray-700/30 p-2 ${building.cost.deuterium > 0 ? '' : 'opacity-50'}`}>
          <div className="text-gray-400">Deutérium</div>
          <div className={`font-mono font-semibold ${building.canAfford ? 'text-purple-400' : 'text-red-400'}`}>
            {formatNumber(building.cost.deuterium)}
          </div>
        </div>
      </div>

      {/* Durée de construction */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-gray-400">Durée de construction:</span>
        <span className="font-mono text-white">{formatTime(building.buildTime)}</span>
      </div>

      {/* Prérequis manquants */}
      {building.missingRequirements.length > 0 && (
        <div className="mb-3 rounded bg-red-500/10 p-2 text-xs text-red-400">
          <div className="font-semibold mb-1">Prérequis manquants:</div>
          <ul className="list-disc list-inside">
            {building.missingRequirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* En construction */}
      {building.inQueue && (
        <div className="mb-3 rounded bg-blue-500/20 p-2 text-center text-sm text-blue-400">
          🔨 En cours de construction...
        </div>
      )}

      {/* Bouton construire */}
      <button
        onClick={handleBuild}
        disabled={!building.canBuild || loading || isBuilding}
        className={`w-full rounded py-2 px-4 font-semibold transition-all duration-200 ${
          building.canBuild && !loading && !isBuilding
            ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {loading ? (
          '⏳ Construction...'
        ) : building.inQueue ? (
          '🔨 En file'
        ) : !building.canAfford ? (
          '💰 Ressources insuffisantes'
        ) : building.missingRequirements.length > 0 ? (
          '🔒 Prérequis manquants'
        ) : (
          `🔨 Construire niveau ${building.currentLevel + 1}`
        )}
      </button>
    </div>
  );
}
