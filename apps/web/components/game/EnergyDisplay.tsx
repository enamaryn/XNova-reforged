'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface EnergyDisplayProps {
  used: number;
  available: number;
  productionLevel: number;
}

/**
 * Composant pour afficher l'énergie de la planète
 *
 * - Énergie disponible vs consommée
 * - Niveau de production (affecte les mines si négatif)
 * - Indicateur visuel du statut
 */
export const EnergyDisplay = memo(function EnergyDisplay({
  used,
  available,
  productionLevel,
}: EnergyDisplayProps) {
  const shouldReduceMotion = useReducedMotion();
  const surplus = available - used;
  const isDeficit = surplus < 0;

  // Formater les nombres
  const formatNumber = (num: number): string => {
    return Math.floor(num).toLocaleString();
  };

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-amber-500/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[0_0_24px_rgba(15,23,42,0.6)]"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h3 className="text-lg font-semibold text-white">Énergie</h3>
        </div>
        {isDeficit && (
          <div className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300">
            DÉFICIT
          </div>
        )}
      </div>

      {/* Stats énergie */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Disponible</div>
          <div className="font-mono text-xl font-bold text-emerald-400">
            {formatNumber(available)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Consommée</div>
          <div className="font-mono text-xl font-bold text-amber-400">
            {formatNumber(used)}
          </div>
        </div>
      </div>

      {/* Surplus/Déficit */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {isDeficit ? 'Déficit' : 'Surplus'}
          </div>
          <div className={`font-mono text-lg font-bold ${isDeficit ? 'text-red-400' : 'text-emerald-400'}`}>
            {surplus >= 0 ? '+' : ''}{formatNumber(surplus)}
          </div>
        </div>
      </div>

      {/* Niveau de production */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">Production mines</div>
          <div className={`font-mono text-base font-semibold ${productionLevel < 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {productionLevel.toFixed(0)}%
          </div>
        </div>
        {productionLevel < 100 && (
          <div className="mt-2 text-xs text-red-300">
            ⚠ Manque d'énergie : production réduite
          </div>
        )}
      </div>

      {/* Barre de progression énergie */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-500 ${isDeficit ? 'bg-red-500' : 'bg-amber-400'}`}
          style={{ width: `${Math.min((available / Math.max(used, 1)) * 100, 100)}%` }}
        />
      </div>
    </motion.div>
  );
});

EnergyDisplay.displayName = 'EnergyDisplay';
