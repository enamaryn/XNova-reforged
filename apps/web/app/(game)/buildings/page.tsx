'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { buildingsApi, type PlanetBuildings, type BuildingInfo } from '@/lib/api/buildings';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { useSocket } from '@/lib/providers/socket-provider';
import { BuildQueuePanel } from '@/components/game/buildings/BuildQueuePanel';
import { BuildingsList } from '@/components/game/buildings/BuildingsList';
import { BuildingDetailModal } from '@/components/game/buildings/BuildingDetailModal';

export default function BuildingsPage() {
  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const { socket } = useSocket();
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInfo | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Initialiser la planète sélectionnée
  useEffect(() => {
    if (!selectedPlanetId && user?.planets?.length) {
      setSelectedPlanetId(user.planets[0].id);
    }
  }, [user, selectedPlanetId, setSelectedPlanetId]);

  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  // Récupérer les bâtiments
  const {
    data: buildingsData,
    isLoading,
    error,
    refetch: refetchBuildings,
  } = useQuery({
    queryKey: ['buildings', planetId],
    queryFn: () => buildingsApi.getPlanetBuildings(planetId!),
    enabled: !!planetId,
    refetchInterval: 30000,
  });

  // Récupérer la file d'attente
  const {
    data: queueData,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['build-queue', planetId],
    queryFn: () => buildingsApi.getBuildQueue(planetId!),
    enabled: !!planetId,
    refetchInterval: 5000,
  });

  // Mutation pour construire
  const buildMutation = useMutation({
    mutationFn: (buildingId: number) =>
      buildingsApi.startBuild(planetId!, buildingId),
    onSuccess: () => {
      refetchBuildings();
      refetchQueue();
      setSelectedBuilding(null);
    },
  });

  // Mutation pour annuler
  const cancelMutation = useMutation({
    mutationFn: (queueId: string) =>
      buildingsApi.cancelBuild(planetId!, queueId),
    onSuccess: () => {
      refetchBuildings();
      refetchQueue();
    },
  });

  // Écouter les événements WebSocket
  useEffect(() => {
    if (!socket || !planetId) return;

    socket.emit('subscribe:planet', { planetId });

    const handleUpdate = () => {
      refetchBuildings();
      refetchQueue();
    };

    socket.on('building:started', handleUpdate);
    socket.on('building:completed', handleUpdate);
    socket.on('building:cancelled', handleUpdate);

    return () => {
      socket.emit('unsubscribe:planet', { planetId });
      socket.off('building:started', handleUpdate);
      socket.off('building:completed', handleUpdate);
      socket.off('building:cancelled', handleUpdate);
    };
  }, [socket, planetId, refetchBuildings, refetchQueue]);

  const handleBuild = useCallback(
    async (buildingId: number) => {
      await buildMutation.mutateAsync(buildingId);
    },
    [buildMutation]
  );

  const handleCancel = useCallback(
    async (queueId: string) => {
      await cancelMutation.mutateAsync(queueId);
    },
    [cancelMutation]
  );

  // États de chargement et erreur
  if (!planetId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">🌍</div>
          <p className="text-slate-400">Chargement des planètes...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-slate-400">Chargement des bâtiments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">Erreur lors du chargement</p>
          <button
            onClick={() => refetchBuildings()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const buildings = buildingsData?.buildings || [];
  const queue = queueData || [];

  // Catégories disponibles
  const categories = ['all', ...new Set(buildings.map(b => b.category))];
  const filteredBuildings = activeCategory === 'all'
    ? buildings
    : buildings.filter(b => b.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Header de page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Bâtiments</h1>
          <p className="text-sm text-slate-400">
            Construisez et améliorez les infrastructures de votre planète
          </p>
        </div>
      </div>

      {/* File de construction */}
      {queue.length > 0 && (
        <BuildQueuePanel queue={queue} onCancel={handleCancel} />
      )}

      {/* Filtres par catégorie */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat === 'all' ? 'Tous' : getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Liste des bâtiments */}
      <BuildingsList
        buildings={filteredBuildings}
        onSelect={setSelectedBuilding}
        isPending={buildMutation.isPending}
      />

      {/* Modal de détail */}
      {selectedBuilding && (
        <BuildingDetailModal
          building={selectedBuilding}
          onClose={() => setSelectedBuilding(null)}
          onBuild={handleBuild}
          isPending={buildMutation.isPending}
          error={buildMutation.error as Error | null}
        />
      )}

      {/* Message d'erreur flottant */}
      {(buildMutation.error || cancelMutation.error) && !selectedBuilding && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-red-500/90 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <p className="text-sm">
            {((buildMutation.error || cancelMutation.error) as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    resource: 'Ressources',
    facility: 'Installations',
    station: 'Stations',
    defense: 'Défense',
    moon: 'Lunaire',
  };
  return labels[category] || category;
}
