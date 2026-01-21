import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '../providers/socket-provider';
import { apiClient } from '../api/client';

interface Resources {
  metal: number;
  crystal: number;
  deuterium: number;
}

interface Production {
  metal: number;
  crystal: number;
  deuterium: number;
}

interface Energy {
  used: number;
  available: number;
  productionLevel: number;
}

interface Storage {
  metal: number;
  crystal: number;
  deuterium: number;
}

interface PlanetResources {
  planetId: string;
  resources: Resources;
  production: Production;
  energy: Energy;
  storage: Storage;
  lastUpdate: string;
}

/**
 * Hook pour gérer les ressources d'une planète avec mise à jour temps réel via WebSocket
 */
export function usePlanetResources(planetId: string | null) {
  const { socket, isConnected } = useSocket();
  const [realtimeData, setRealtimeData] = useState<Partial<PlanetResources> | null>(null);

  // Récupérer les ressources initiales via l'API REST
  const query = useQuery<PlanetResources>({
    queryKey: ['planet', planetId, 'resources'],
    queryFn: async () => {
      if (!planetId) throw new Error('No planet ID provided');
      return await apiClient.get<PlanetResources>(`/planets/${planetId}/resources`);
    },
    enabled: !!planetId,
    refetchInterval: 60000, // Fallback: refetch toutes les minutes si WebSocket échoue
    staleTime: 30000, // Considérer les données comme fraîches pendant 30s
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // S'abonner aux événements WebSocket pour cette planète
  useEffect(() => {
    if (!socket || !isConnected || !planetId) return;

    console.log(`[usePlanetResources] Subscribing to planet ${planetId}`);

    // S'abonner aux événements de cette planète
    socket.emit('subscribe:planet', { planetId });

    // Écouter les mises à jour de ressources
    const handleResourcesUpdate = (data: any) => {
      if (data.planetId === planetId) {
        console.log('[usePlanetResources] Received resources update:', data);
        setRealtimeData({
          planetId: data.planetId,
          resources: data.resources,
          production: data.production,
          energy: data.energy,
          storage: data.storage,
        });
      }
    };

    socket.on('resources:updated', handleResourcesUpdate);

    // Cleanup
    return () => {
      console.log(`[usePlanetResources] Unsubscribing from planet ${planetId}`);
      socket.emit('unsubscribe:planet', { planetId });
      socket.off('resources:updated', handleResourcesUpdate);
    };
  }, [socket, isConnected, planetId]);

  // Fusionner les données API et temps réel (priorité au temps réel)
  const apiData = query.data;
  const data = realtimeData ? ({ ...apiData, ...realtimeData } as PlanetResources) : apiData;

  return {
    ...query,
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRealtimeConnected: isConnected,
  };
}
