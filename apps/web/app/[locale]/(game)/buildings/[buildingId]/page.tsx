'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { buildingsApi } from '@/lib/api/buildings';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { designTokens } from '@/lib/design-tokens';

export default function BuildingDetailPage() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;

  const params = useParams<{ buildingId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedPlanetId } = usePlanetStore();
  const planetId = selectedPlanetId || user?.planets?.[0]?.id;
  const buildingId = Number(params.buildingId);

  const { data, isLoading } = useQuery({
    queryKey: ['buildings', planetId],
    queryFn: () => buildingsApi.getPlanetBuildings(planetId!),
    enabled: !!planetId,
  });

  const building = useMemo(
    () => data?.buildings?.find((item) => item.id === buildingId),
    [data, buildingId],
  );

  const buildMutation = useMutation({
    mutationFn: (id: number) => buildingsApi.startBuild(planetId!, id),
    onSuccess: () => {
      router.push('/buildings');
    },
  });

  if (!planetId) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
        Sélectionnez une planète pour consulter les bâtiments.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
        Chargement du bâtiment...
      </div>
    );
  }

  if (!building) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
          Bâtiment introuvable.
        </div>
        <Link
          href="/buildings"
          className="text-sm text-blue-300 hover:text-blue-200"
        >
          Retour aux bâtiments
        </Link>
      </div>
    );
  }

  const canBuild = building.canBuild && !buildMutation.isPending;

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Bâtiment
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{building.name}</h1>
          <p className="text-sm text-slate-400">
            Niveau actuel : {building.currentLevel}
          </p>
        </div>
        <Link
          href="/buildings"
          className="rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-white"
        >
          Retour
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <p className="text-sm text-slate-300">{building.description}</p>
          <div className="mt-6 grid gap-3 text-sm text-slate-400">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Durée de construction</span>
              <span className="font-mono text-slate-200">{building.buildTime}s</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Catégorie</span>
              <span className="font-mono text-slate-200">{getCategoryLabel(building.category)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Coûts
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Métal</span>
              <span className="font-mono text-amber-300">{building.cost.metal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Cristal</span>
              <span className="font-mono text-sky-300">{building.cost.crystal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Deutérium</span>
              <span className="font-mono text-blue-300">{building.cost.deuterium}</span>
            </div>
          </div>

          {building.missingRequirements.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
              <p className="mb-2 font-semibold">Prérequis manquants</p>
              <ul className="list-disc list-inside">
                {building.missingRequirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => buildMutation.mutate(building.id)}
            disabled={!canBuild}
            className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition ${
              canBuild
                ? 'bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {building.inQueue
              ? 'Déjà en construction'
              : buildMutation.isPending
                ? 'Construction...'
                : `Construire niveau ${building.currentLevel + 1}`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    resource: 'Ressource',
    facility: 'Installation',
    station: 'Station',
    defense: 'Défense',
    moon: 'Lunaire',
  };
  return labels[category] || category;
}
