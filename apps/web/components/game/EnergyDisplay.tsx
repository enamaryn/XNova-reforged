'use client';

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
export function EnergyDisplay({ used, available, productionLevel }: EnergyDisplayProps) {
  const surplus = available - used;
  const isDeficit = surplus < 0;

  // Formater les nombres
  const formatNumber = (num: number): string => {
    return Math.floor(num).toLocaleString();
  };

  return (
    <div className="rounded-lg border border-yellow-500 bg-gray-800/50 p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h3 className="text-lg font-semibold text-white">Énergie</h3>
        </div>
        {isDeficit && (
          <div className="rounded bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-400">
            DÉFICIT
          </div>
        )}
      </div>

      {/* Stats énergie */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-400">Disponible</div>
          <div className="font-mono text-xl font-bold text-green-400">
            {formatNumber(available)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Consommée</div>
          <div className="font-mono text-xl font-bold text-orange-400">
            {formatNumber(used)}
          </div>
        </div>
      </div>

      {/* Surplus/Déficit */}
      <div className="mt-3 border-t border-gray-700 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {isDeficit ? 'Déficit' : 'Surplus'}
          </div>
          <div className={`font-mono text-lg font-bold ${isDeficit ? 'text-red-400' : 'text-green-400'}`}>
            {surplus >= 0 ? '+' : ''}{formatNumber(surplus)}
          </div>
        </div>
      </div>

      {/* Niveau de production */}
      <div className="mt-3 border-t border-gray-700 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">Production mines</div>
          <div className={`font-mono text-base font-semibold ${productionLevel < 100 ? 'text-orange-400' : 'text-green-400'}`}>
            {productionLevel.toFixed(0)}%
          </div>
        </div>
        {productionLevel < 100 && (
          <div className="mt-2 text-xs text-red-400">
            ⚠ Manque d'énergie : production réduite
          </div>
        )}
      </div>

      {/* Barre de progression énergie */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full transition-all duration-500 ${isDeficit ? 'bg-red-500' : 'bg-yellow-500'}`}
          style={{ width: `${Math.min((available / Math.max(used, 1)) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
