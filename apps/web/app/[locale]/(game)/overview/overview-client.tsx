'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { apiClient } from '@/lib/api/client';
import { usePlanetResources } from '@/lib/hooks/use-planet-resources';
import { ResourceDisplay } from '@/components/game/ResourceDisplay';
import { EnergyDisplay } from '@/components/game/EnergyDisplay';
import { PlanetScene } from '@/components/game/PlanetScene';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { renamePlanet } from '@/lib/api/planets';
import { designTokens } from '@/lib/design-tokens';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

export default function OverviewClient() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const slideUpProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.slideUp;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  };

  const { user } = useAuthStore();
  const setUser = useAuthStore((state) => state.setUser);
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const [showCommanderPanel, setShowCommanderPanel] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [planetNameDraft, setPlanetNameDraft] = useState('');

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
  }, [planets, selectedPlanetId, setSelectedPlanetId]);

  // Récupérer les ressources de la planète sélectionnée (avec WebSocket)
  const {
    data: resources,
    isLoading: resourcesLoading,
    error,
    isRealtimeConnected,
  } = usePlanetResources(selectedPlanetId);

  const renameMutation = useMutation({
    mutationFn: (name: string) => renamePlanet(selectedPlanetId!, name),
    onSuccess: (updated) => {
      if (user) {
        const planets = user.planets?.map((planet) =>
          planet.id === updated.id ? { ...planet, name: updated.name } : planet,
        );
        setUser({ ...user, planets });
      }
      setPlanetNameDraft(updated.name);
      setIsRenaming(false);
    },
  });

  const selectedPlanet = planets?.find((p) => p.id === selectedPlanetId);
  const coordinates = selectedPlanet
    ? `[${selectedPlanet.galaxy}:${selectedPlanet.system}:${selectedPlanet.position}]`
    : '';
  const commanderProgress = user?.points ? Math.min(100, (user.points % 1000) / 10) : 0;

  useEffect(() => {
    if (!isRenaming && selectedPlanet) {
      setPlanetNameDraft(selectedPlanet.name);
    }
  }, [isRenaming, selectedPlanet]);

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

  return (
    <motion.div {...fadeInProps} initial={false} className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Commandement
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Vue d'ensemble
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-xs text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-400' : 'bg-red-500'}`}
          />
          {isRealtimeConnected ? 'Temps réel actif' : 'Temps réel inactif'}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Commandant
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setShowCommanderPanel((prev) => !prev)}
              className="relative h-16 w-16 rounded-full border border-blue-500/40 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-2xl text-white shadow-[0_0_16px_rgba(59,130,246,0.3)]"
              aria-label="Ouvrir les statistiques du commandant"
            >
              {user?.username?.charAt(0).toUpperCase() || 'C'}
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {user?.username || 'Commandant'}
              </h2>
              <p className="text-xs text-slate-400">
                Rang #{user?.rank ?? '-'} · {user?.points ?? 0} points
              </p>
            </div>
            <div className="w-full sm:ml-auto sm:min-w-[160px] sm:max-w-[220px]">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <span>Progression</span>
                <span>{commanderProgress.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 transition-all"
                  style={{ width: `${commanderProgress}%` }}
                />
              </div>
            </div>
          </div>

          {showCommanderPanel && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCommanderPanel(false)}
              />
              <div className="absolute left-6 top-full z-50 mt-3 w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Statistiques compte
                  </p>
                  <button
                    onClick={() => setShowCommanderPanel(false)}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    Fermer
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
                    <span>Planètes</span>
                    <span className="font-mono">{user?.planets?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
                    <span>Rang</span>
                    <span className="font-mono">#{user?.rank ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
                    <span>Points</span>
                    <span className="font-mono">{user?.points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
                    <span>Email</span>
                    <span className="font-mono text-xs">{user?.email || '-'}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Planète
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {isRenaming ? (
              <input
                value={planetNameDraft}
                onChange={(event) => setPlanetNameDraft(event.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {planetNameDraft || selectedPlanet?.name || 'Planète'}
                </h3>
                <p className="text-xs text-slate-400">{coordinates}</p>
              </div>
            )}
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
              {isRenaming ? (
                <>
                  <div className="flex flex-col gap-1 sm:items-end">
                    <button
                      onClick={() => renameMutation.mutate(planetNameDraft)}
                      disabled={renameMutation.isPending || !planetNameDraft.trim()}
                      className="w-full rounded-full border border-blue-500/50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-blue-200 hover:border-blue-400 disabled:border-slate-800 disabled:text-slate-500 sm:w-auto"
                    >
                      {renameMutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setPlanetNameDraft(selectedPlanet?.name || '');
                      setIsRenaming(false);
                    }}
                    className="w-full text-xs text-slate-400 hover:text-white sm:w-auto"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsRenaming(true)}
                  className="w-full rounded-full border border-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-white sm:w-auto"
                >
                  Renommer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur de planète (si plusieurs planètes) */}
      {planets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {planets.map((planet) => (
            <button
              key={planet.id}
              onClick={() => setSelectedPlanetId(planet.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] transition-colors ${
                planet.id === selectedPlanetId
                  ? 'border-blue-400/60 bg-blue-500/10 text-blue-200'
                  : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
              }`}
            >
              {planet.name}
            </button>
          ))}
        </div>
      )}

      {selectedPlanet && (
        <motion.div {...slideUpProps} initial={false}>
          <PlanetScene
            planetName={selectedPlanet.name}
            coordinates={coordinates}
          />
        </motion.div>
      )}

      {/* Ressources */}
      {resourcesLoading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-800/80 bg-slate-900/40">
          <div className="text-slate-400">Chargement des ressources...</div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          Erreur lors du chargement des ressources
        </div>
      ) : resources ? (
        <motion.div
          variants={shouldReduceMotion ? undefined : listVariants}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          animate={shouldReduceMotion ? undefined : 'show'}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {/* Métal */}
          <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
            <ResourceDisplay
              name="Métal"
              icon="⛏️"
              amount={resources.resources.metal}
              production={resources.production.metal}
              storage={resources.storage.metal}
              color="blue"
            />
          </motion.div>

          {/* Cristal */}
          <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
            <ResourceDisplay
              name="Cristal"
              icon="💎"
              amount={resources.resources.crystal}
              production={resources.production.crystal}
              storage={resources.storage.crystal}
              color="green"
            />
          </motion.div>

          {/* Deutérium */}
          <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
            <ResourceDisplay
              name="Deutérium"
              icon="🛢️"
              amount={resources.resources.deuterium}
              production={resources.production.deuterium}
              storage={resources.storage.deuterium}
              color="purple"
            />
          </motion.div>

          {/* Énergie */}
          <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
            <EnergyDisplay
              used={resources.energy.used}
              available={resources.energy.available}
              productionLevel={resources.energy.productionLevel}
            />
          </motion.div>
        </motion.div>
      ) : null}

      {/* Navigation rapide */}
      <motion.div
        variants={shouldReduceMotion ? undefined : listVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        animate={shouldReduceMotion ? undefined : 'show'}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { href: '/buildings', title: 'Bâtiments', desc: 'Évoluer l’infrastructure', icon: '🏗️' },
          { href: '/research', title: 'Technologies', desc: 'Débloquer de nouveaux atouts', icon: '🔬' },
          { href: '/fleet', title: 'Flotte', desc: 'Préparer les mouvements', icon: '🛸' },
          { href: '/galaxy', title: 'Galaxie', desc: 'Explorer les systèmes', icon: '🌌' },
        ].map((item) => (
          <motion.div key={item.href} variants={shouldReduceMotion ? undefined : itemVariants}>
            <Link
              href={item.href}
              className="group block rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition hover:border-blue-500/50 hover:bg-slate-900/70"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
                </div>
                <div className="text-3xl">{item.icon}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
