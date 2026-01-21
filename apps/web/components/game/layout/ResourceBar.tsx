'use client';

import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { apiClient } from '@/lib/api/client';

interface Resources {
  metal?: number;
  crystal?: number;
  deuterium?: number;
  energy?: number | { used: number; available: number };
  energyUsed?: number;
  resources?: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

interface ResourceBarProps {
  compact?: boolean;
}

// Formater les grands nombres
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}G`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Math.floor(num).toLocaleString('fr-FR');
}

export function ResourceBar({ compact = false }: ResourceBarProps) {
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  const { data: resources } = useQuery({
    queryKey: ['resources', planetId],
    queryFn: async () => {
      if (!planetId) return null;
      const data = await apiClient.get<Resources>(`/planets/${planetId}/resources`);
      return data;
    },
    enabled: !!planetId,
    refetchInterval: 10000, // Actualiser toutes les 10s
  });

  const computedResources = useMemo(() => {
    const resourcePayload = resources?.resources;
    const metalValue = Number(resourcePayload?.metal ?? resources?.metal ?? 0);
    const crystalValue = Number(resourcePayload?.crystal ?? resources?.crystal ?? 0);
    const deuteriumValue = Number(resourcePayload?.deuterium ?? resources?.deuterium ?? 0);
    const energyPayload =
      resources && typeof resources.energy === 'object' ? resources.energy : undefined;
    const energyValue = Number(energyPayload?.available ?? resources?.energy ?? 0);
    const energyUsedValue = Number(energyPayload?.used ?? resources?.energyUsed ?? 0);
    const safeEnergy = Number.isNaN(energyValue) ? 0 : energyValue;
    const safeEnergyUsed = Number.isNaN(energyUsedValue) ? 0 : energyUsedValue;
    return {
      metal: metalValue,
      crystal: crystalValue,
      deuterium: deuteriumValue,
      energyBalance: safeEnergy - safeEnergyUsed,
    };
  }, [resources]);
  const { metal, crystal, deuterium, energyBalance } = computedResources;

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:flex sm:items-center sm:justify-around sm:gap-4 sm:text-xs">
        <MemoizedResourceItem
          icon="⚙️"
          value={metal}
          color="text-amber-400"
          compact
        />
        <MemoizedResourceItem
          icon="💎"
          value={crystal}
          color="text-sky-300"
          compact
        />
        <MemoizedResourceItem
          icon="🧪"
          value={deuterium}
          color="text-blue-300"
          compact
        />
        <MemoizedResourceItem
          icon="⚡"
          value={energyBalance}
          color={energyBalance >= 0 ? 'text-green-400' : 'text-red-400'}
          compact
          showSign
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <MemoizedResourceItem
        label="Métal"
        icon="⚙️"
        value={metal}
        color="text-amber-400"
      />
      <div className="w-px h-6 bg-slate-800" />
      <MemoizedResourceItem
        label="Cristal"
        icon="💎"
        value={crystal}
        color="text-sky-300"
      />
      <div className="w-px h-6 bg-slate-800" />
      <MemoizedResourceItem
        label="Deutérium"
        icon="🧪"
        value={deuterium}
        color="text-blue-300"
      />
      <div className="w-px h-6 bg-slate-800" />
      <MemoizedResourceItem
        label="Énergie"
        icon="⚡"
        value={energyBalance}
        color={energyBalance >= 0 ? 'text-green-400' : 'text-red-400'}
        showSign
      />
    </div>
  );
}

interface ResourceItemProps {
  label?: string;
  icon: string;
  value: number;
  color: string;
  compact?: boolean;
  showSign?: boolean;
}

function ResourceItem({ label, icon, value, color, compact, showSign }: ResourceItemProps) {
  const displayValue = formatNumber(Math.abs(value));
  const sign = showSign && value !== 0 ? (value > 0 ? '+' : '-') : '';

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-base">{icon}</span>
        <span className={`font-mono font-medium ${color}`}>
          {sign}{displayValue}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-slate-800/50 transition-colors cursor-default">
      <span className="text-lg">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={`font-mono text-sm font-semibold ${color}`}>
          {sign}{displayValue}
        </span>
      </div>
    </div>
  );
}

const MemoizedResourceItem = memo(ResourceItem);
