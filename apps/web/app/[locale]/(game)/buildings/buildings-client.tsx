"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { buildingsApi } from "@/lib/api/buildings";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";
import { useSocket } from "@/lib/providers/socket-provider";
import { BuildQueue } from "@/components/game/BuildQueue";
import { BuildingCard } from "@/components/game/BuildingCard";
import { ContextHelp } from "@/components/game/ContextHelp";

export default function BuildingsClient() {
  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const { socket } = useSocket();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    queryKey: ["buildings", planetId],
    queryFn: () => buildingsApi.getPlanetBuildings(planetId!),
    enabled: !!planetId,
    refetchInterval: 30000,
  });

  // Récupérer la file d'attente
  const { data: queueData, refetch: refetchQueue } = useQuery({
    queryKey: ["build-queue", planetId],
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

  const pushToast = useCallback((message: string) => {
    setToastMessage(message);
    const timeout = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, []);

  // Écouter les événements WebSocket
  useEffect(() => {
    if (!socket || !planetId) return;

    socket.emit("subscribe:planet", { planetId });

    const handleUpdate = () => {
      refetchBuildings();
      refetchQueue();
    };

    const handleCompleted = (payload?: {
      buildingName?: string;
      newLevel?: number;
    }) => {
      handleUpdate();
      const name = payload?.buildingName || "Bâtiment";
      const level = payload?.newLevel ? ` niv. ${payload.newLevel}` : "";
      pushToast(`Construction terminée : ${name}${level}`);
    };

    socket.on("building:started", handleUpdate);
    socket.on("building:completed", handleCompleted);
    socket.on("building:cancelled", handleUpdate);

    return () => {
      socket.emit("unsubscribe:planet", { planetId });
      socket.off("building:started", handleUpdate);
      socket.off("building:completed", handleCompleted);
      socket.off("building:cancelled", handleUpdate);
    };
  }, [socket, planetId, refetchBuildings, refetchQueue, pushToast]);

  const handleBuild = useCallback(
    async (buildingId: number) => {
      await buildMutation.mutateAsync(buildingId);
    },
    [buildMutation],
  );

  const handleCancel = useCallback(
    async (queueId: string) => {
      await cancelMutation.mutateAsync(queueId);
    },
    [cancelMutation],
  );

  // Calculs dérivés - DOIVENT être avant les returns conditionnels
  // Utiliser buildingsData entier comme dépendance, pas buildingsData.buildings
  const buildings = useMemo(
    () => buildingsData?.buildings || [],
    [buildingsData],
  );
  const queue = queueData || [];

  const categories = useMemo(
    () => ["all", ...new Set(buildings.map((building) => building.category))],
    [buildings],
  );
  const filteredBuildings = useMemo(
    () =>
      activeCategory === "all"
        ? buildings
        : buildings.filter((building) => building.category === activeCategory),
    [activeCategory, buildings],
  );

  // États de chargement et erreur - APRÈS tous les hooks
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

  return (
    <div className="space-y-1 sm:space-y-6">
      {/* Header de page */}
      <div className="flex items-center justify-between gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="hidden text-[10px] uppercase tracking-[0.3em] sm:block text-slate-500">
            Infrastructure
          </p>
          <h1 className="text-xl sm:mt-2 sm:text-2xl font-semibold text-white">
            Bâtiments
          </h1>
          <p className="hidden text-sm text-slate-400 sm:block">
            Construisez et améliorez les infrastructures de votre planète
          </p>
        </div>
        <div className="rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-xs text-slate-400">
          {queue.length}
          {buildingsData?.buildings[0]?.buildingCapacity
            ? ` / ${buildingsData.buildings[0].buildingCapacity}`
            : ""}{" "}
          en cours
        </div>
      </div>
      <div className="hidden sm:block">
        <ContextHelp topic="buildings" />
      </div>

      {/* File de construction */}
      <div className={queue.length ? "" : "hidden sm:block"}>
        <BuildQueue queue={queue} onCancel={handleCancel} />
      </div>

      {/* Filtres par catégorie */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`min-h-11 shrink-0 rounded-full border px-3 py-2 text-xs sm:px-4 sm:uppercase sm:tracking-[0.2em] transition-colors ${
              activeCategory === cat
                ? "border-blue-400/60 bg-blue-500/10 text-blue-200"
                : "border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white"
            }`}
          >
            {cat === "all" ? "Tous" : getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Liste des bâtiments */}
      <div className="grid gap-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filteredBuildings.map((building) => (
          <div key={building.id}>
            <BuildingCard
              building={building}
              onBuild={handleBuild}
              isBuilding={buildMutation.isPending}
            />
          </div>
        ))}
      </div>

      {/* Message d'erreur flottant */}
      {(buildMutation.error || cancelMutation.error) && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-red-500/90 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <p className="text-sm">
            {((buildMutation.error || cancelMutation.error) as Error).message}
          </p>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 left-4 max-w-sm rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-200 shadow-lg backdrop-blur-sm">
          <p className="text-sm">{toastMessage}</p>
        </div>
      )}
    </div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    resource: "Ressource",
    facility: "Installations",
    station: "Stations",
    defense: "Défense",
    moon: "Lunaire",
  };
  return labels[category] || category;
}
