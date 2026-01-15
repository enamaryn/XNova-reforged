'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { apiClient } from '@/lib/api/client';

interface Resources {
  metal: number;
  crystal: number;
  deuterium: number;
  energy: number;
  energyUsed: number;
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

  const metal = resources?.metal ?? 0;
  const crystal = resources?.crystal ?? 0;
  const deuterium = resources?.deuterium ?? 0;
  const energy = resources?.energy ?? 0;
  const energyUsed = resources?.energyUsed ?? 0;
  const energyBalance = energy - energyUsed;

  if (compact) {
    return (
      <div className="flex items-center justify-around gap-4 text-xs">
        <ResourceItem
          icon="⚙️"
          value={metal}
          color="text-amber-400"
          compact
        />
        <ResourceItem
          icon="💎"
          value={crystal}
          color="text-sky-300"
          compact
        />
        <ResourceItem
          icon="🧪"
          value={deuterium}
          color="text-blue-300"
          compact
        />
        <ResourceItem
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
      <ResourceItem
        label="Métal"
        icon="⚙️"
        value={metal}
        color="text-amber-400"
      />
      <div className="w-px h-6 bg-slate-800" />
      <ResourceItem
        label="Cristal"
        icon="💎"
        value={crystal}
        color="text-sky-300"
      />
      <div className="w-px h-6 bg-slate-800" />
      <ResourceItem
        label="Deutérium"
        icon="🧪"
        value={deuterium}
        color="text-blue-300"
      />
      <div className="w-px h-6 bg-slate-800" />
      <ResourceItem
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
