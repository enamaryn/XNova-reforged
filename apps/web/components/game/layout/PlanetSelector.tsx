'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';

export function PlanetSelector() {
  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const [isOpen, setIsOpen] = useState(false);

  const planets = user?.planets || [];
  const currentPlanet = planets.find(p => p.id === selectedPlanetId) || planets[0];

  // Sélectionner la première planète si aucune n'est sélectionnée
  useEffect(() => {
    if (!selectedPlanetId && planets.length > 0) {
      setSelectedPlanetId(planets[0].id);
    }
  }, [planets, selectedPlanetId, setSelectedPlanetId]);

  if (planets.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        Aucune planète
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex max-w-[160px] min-w-0 items-center gap-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-sm transition-colors hover:border-slate-600 sm:max-w-none"
      >
        <span className="text-lg">🌍</span>
        <div className="text-left hidden sm:block">
          <div className="font-medium text-white">{currentPlanet?.name || 'Planète'}</div>
          <div className="text-[10px] text-slate-500">
            [{currentPlanet?.galaxy}:{currentPlanet?.system}:{currentPlanet?.position}]
          </div>
        </div>
        <div className="sm:hidden truncate text-white font-medium">
          {currentPlanet?.name?.substring(0, 8) || 'Planète'}
        </div>
        {planets.length > 1 && (
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && planets.length > 1 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-950/95 py-1 shadow-xl z-20">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800">
              Vos planètes ({planets.length})
            </div>
            {planets.map((planet) => (
              <button
                key={planet.id}
                onClick={() => {
                  setSelectedPlanetId(planet.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  planet.id === selectedPlanetId
                    ? 'bg-blue-500/15 text-blue-300'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span className="text-xl">🌍</span>
                <div>
                  <div className="font-medium">{planet.name}</div>
                  <div className="text-xs text-slate-500">
                    [{planet.galaxy}:{planet.system}:{planet.position}]
                  </div>
                </div>
                {planet.id === selectedPlanetId && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
