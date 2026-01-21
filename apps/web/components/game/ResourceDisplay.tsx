'use client';

import { memo, useEffect, useState } from 'react';
import { useMotionValueEvent, useReducedMotion, useSpring } from 'framer-motion';

interface ResourceDisplayProps {
  name: string;
  icon?: string;
  amount: number;
  production: number;
  storage: number;
  color?: string;
}

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 28, mass: 0.6 });
  const [displayValue, setDisplayValue] = useState(format(value));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useMotionValueEvent(spring, 'change', (latest) => {
    if (shouldReduceMotion) {
      return;
    }
    setDisplayValue(format(latest));
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(format(value));
    }
  }, [format, shouldReduceMotion, value]);

  return <span>{displayValue}</span>;
}

/**
 * Composant pour afficher une ressource avec compteur animé
 *
 * Features :
 * - Affichage formaté des quantités (K, M, B)
 * - Animation du compteur en temps réel
 * - Barre de progression du stockage
 * - Indicateur de production par heure
 */
export const ResourceDisplay = memo(function ResourceDisplay({
  name,
  icon,
  amount,
  production,
  storage,
  color = 'blue',
}: ResourceDisplayProps) {
  const [currentAmount, setCurrentAmount] = useState(amount);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Mettre à jour le montant actuel quand les props changent (WebSocket update)
  useEffect(() => {
    setCurrentAmount(amount);
    setLastUpdate(Date.now());
  }, [amount]);

  // Animation du compteur (production par seconde)
  useEffect(() => {
    if (production <= 0) return;

    const productionPerSecond = production / 3600; // Production par heure -> par seconde

    const interval = setInterval(() => {
      setCurrentAmount((prev) => {
        const newAmount = prev + productionPerSecond;
        // Limiter au storage max
        return Math.min(newAmount, storage);
      });
    }, 1000); // Update toutes les secondes

    return () => clearInterval(interval);
  }, [production, storage]);

  // Formater les grands nombres (1000 -> 1K, 1000000 -> 1M)
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return Math.floor(num).toLocaleString();
  };

  // Calculer le pourcentage de remplissage du stockage
  const storagePercent = Math.min((currentAmount / storage) * 100, 100);

  // Couleurs selon le type de ressource
  const colors = {
    blue: 'bg-sky-400',
    green: 'bg-emerald-400',
    purple: 'bg-violet-400',
    yellow: 'bg-amber-400',
  };

  const borderColors = {
    blue: 'border-sky-500/50',
    green: 'border-emerald-500/50',
    purple: 'border-violet-500/50',
    yellow: 'border-amber-500/50',
  };

  return (
    <div className={`rounded-2xl border ${borderColors[color as keyof typeof borderColors] || borderColors.blue} bg-slate-900/60 p-4 backdrop-blur-sm shadow-[0_0_24px_rgba(15,23,42,0.6)]`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-2xl">{icon}</span>}
          <h3 className="text-lg font-semibold text-white">{name}</h3>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Prod/h</div>
          <div className={`font-mono text-sm font-semibold ${production >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {production >= 0 ? '+' : ''}{formatNumber(production)}
          </div>
        </div>
      </div>

      {/* Montant actuel */}
      <div
        className="mb-2"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="font-mono text-3xl font-bold text-white">
          <AnimatedNumber value={currentAmount} format={formatNumber} />
        </div>
        <div className="text-xs text-slate-500">
          Max: {formatNumber(storage)}
        </div>
      </div>

      {/* Barre de progression du stockage */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-label={`${name} : stockage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(storagePercent)}
        aria-valuetext={`${storagePercent.toFixed(1)}% plein`}
      >
        <div
          className={`h-full transition-all duration-500 ${colors[color as keyof typeof colors] || colors.blue}`}
          style={{ width: `${storagePercent}%` }}
        />
      </div>

      {/* Pourcentage */}
      <div className="mt-1 text-right text-xs text-slate-500">
        {storagePercent.toFixed(1)}%
      </div>
    </div>
  );
});

ResourceDisplay.displayName = 'ResourceDisplay';
