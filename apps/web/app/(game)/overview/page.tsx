'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { usePlanetResources } from '@/lib/hooks/use-planet-resources';
import { ResourceDisplay } from '@/components/game/ResourceDisplay';
import { EnergyDisplay } from '@/components/game/EnergyDisplay';

// Forcer le rendu côté client uniquement
export const dynamic = 'force-dynamic';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

export default function OverviewPage() {
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);

  // Récupérer la liste des planètes de l'utilisateur
  const { data: planets, isLoading: planetsLoading } = useQuery<Planet[]>({
    queryKey: ['user-planets'],
    queryFn: async () => {
      const response = await apiClient.get<{ planets: Planet[] }>('/auth/me');
      return response.planets || [];
    },
  });

  // Sélectionner automatiquement la première planète
  useEffect(() => {
    if (planets && planets.length > 0 && !selectedPlanetId) {
      setSelectedPlanetId(planets[0].id);
    }
  }, [planets, selectedPlanetId]);

  // Récupérer les ressources de la planète sélectionnée (avec WebSocket)
  const {
    data: resources,
    isLoading: resourcesLoading,
    error,
    isRealtimeConnected,
  } = usePlanetResources(selectedPlanetId);

  if (planetsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Chargement des planètes...</div>
      </div>
    );
  }

  if (!planets || planets.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Aucune planète trouvée</div>
      </div>
    );
  }

  const selectedPlanet = planets.find((p) => p.id === selectedPlanetId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Vue d'ensemble
          </h1>
          {selectedPlanet && (
            <p className="mt-1 text-sm text-gray-400">
              {selectedPlanet.name} [{selectedPlanet.galaxy}:{selectedPlanet.system}:{selectedPlanet.position}]
            </p>
          )}
        </div>

        {/* Indicateur connexion temps réel */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-gray-400">
            {isRealtimeConnected ? 'Temps réel actif' : 'Temps réel inactif'}
          </span>
        </div>
      </div>

      {/* Sélecteur de planète (si plusieurs planètes) */}
      {planets.length > 1 && (
        <div className="flex gap-2">
          {planets.map((planet) => (
            <button
              key={planet.id}
              onClick={() => setSelectedPlanetId(planet.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                planet.id === selectedPlanetId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {planet.name}
            </button>
          ))}
        </div>
      )}

      {/* Ressources */}
      {resourcesLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400">Chargement des ressources...</div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-red-400">
          Erreur lors du chargement des ressources
        </div>
      ) : resources ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Métal */}
          <ResourceDisplay
            name="Métal"
            icon="⛏️"
            amount={resources.resources.metal}
            production={resources.production.metal}
            storage={resources.storage.metal}
            color="blue"
          />

          {/* Cristal */}
          <ResourceDisplay
            name="Cristal"
            icon="💎"
            amount={resources.resources.crystal}
            production={resources.production.crystal}
            storage={resources.storage.crystal}
            color="green"
          />

          {/* Deutérium */}
          <ResourceDisplay
            name="Deutérium"
            icon="🛢️"
            amount={resources.resources.deuterium}
            production={resources.production.deuterium}
            storage={resources.storage.deuterium}
            color="purple"
          />

          {/* Énergie */}
          <EnergyDisplay
            used={resources.energy.used}
            available={resources.energy.available}
            productionLevel={resources.energy.productionLevel}
          />
        </div>
      ) : null}

      {/* Informations supplémentaires */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activité récente (placeholder) */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Activité récente
          </h3>
          <p className="text-sm text-gray-400">
            Aucune activité récente
          </p>
        </div>

        {/* Flottes en cours (placeholder) */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Flottes en cours
          </h3>
          <p className="text-sm text-gray-400">
            Aucune flotte en déplacement
          </p>
        </div>
      </div>
    </div>
  );
}
