'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TECHNOLOGIES, getTechnologyCost } from '@xnova/game-config';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';
import { researchApi } from '@/lib/api/research';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';

export function ResearchDetailClient({ techId }: { techId: string }) {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const techIdNum = Number(techId);
  const tech = TECHNOLOGIES[techIdNum];
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();

  useEffect(() => {
    if (!selectedPlanetId && user?.planets?.length) {
      setSelectedPlanetId(user.planets[0].id);
    }
  }, [user, selectedPlanetId, setSelectedPlanetId]);

  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  // Etat réel de la technologie pour la planète sélectionnée (niveau, coût, prérequis, énergie)
  const { data: techData } = useQuery({
    queryKey: ['technologies', planetId],
    queryFn: () => researchApi.getTechnologies(planetId!),
    enabled: !!planetId && !!tech,
    refetchInterval: 30000,
  });
  const info = techData?.technologies.find((item) => item.id === techIdNum);

  const startMutation = useMutation({
    mutationFn: () => researchApi.startResearch(planetId!, techIdNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technologies', planetId] });
      queryClient.invalidateQueries({ queryKey: ['research-queue'] });
    },
  });

  if (!tech) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
          Technologie introuvable.
        </div>
        <Link
          href="/research"
          className="text-sm text-blue-300 hover:text-blue-200"
        >
          Retour aux technologies
        </Link>
      </div>
    );
  }

  const baseCost = getTechnologyCost(tech.id, 0);

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Technologie
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{tech.name}</h1>
          <p className="text-sm text-slate-400">{tech.description}</p>
        </div>
        <Link
          href="/research"
          className="rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-white"
        >
          Retour
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Détails
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Catégorie</span>
              <span className="font-mono text-slate-200">{t(`techCategory.${tech.category}`)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Facteur</span>
              <span className="font-mono text-slate-200">{tech.factor.toFixed(1)}</span>
            </div>
          </div>

          {tech.requirements && (
            <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-sm text-slate-400">
              <p className="mb-2 font-semibold text-slate-200">Prérequis</p>
              <ul className="list-disc list-inside">
                {Object.entries(tech.requirements).map(([key, value]) => (
                  <li key={key}>
                    ID {key} niveau {value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Coût niveau 1
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Métal</span>
              <span className="font-mono text-amber-300">{baseCost.metal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Cristal</span>
              <span className="font-mono text-sky-300">{baseCost.crystal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Deutérium</span>
              <span className="font-mono text-blue-300">{baseCost.deuterium}</span>
            </div>
            {baseCost.energy !== undefined && (
              <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
                <span>Énergie</span>
                <span className="font-mono text-amber-200">{baseCost.energy}</span>
              </div>
            )}
          </div>

          {info && (
            <div className="mt-6 space-y-2 text-sm text-slate-400">
              <div className="flex items-center justify-between">
                <span>Niveau actuel</span>
                <span className="font-mono text-slate-200">{info.currentLevel}</span>
              </div>
              {info.energyRequired ? (
                <div className="flex items-center justify-between">
                  <span>Énergie produite / requise</span>
                  <span
                    className={`font-mono ${info.hasEnoughEnergy ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {info.energyAvailable} / {info.energyRequired}
                  </span>
                </div>
              ) : null}
              {info.missingRequirements.length > 0 && (
                <ul className="list-disc list-inside text-rose-300">
                  {info.missingRequirements.map((missing) => (
                    <li key={missing}>{missing}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={() => startMutation.mutate()}
            disabled={!planetId || !info?.canResearch || startMutation.isPending}
            className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold ${
              info?.canResearch && !startMutation.isPending
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {startMutation.isPending
              ? 'Lancement...'
              : info?.isMaxLevel
                ? 'Niveau maximum atteint'
                : info?.inQueue
                  ? 'Recherche en cours'
                  : 'Lancer la recherche'}
          </button>
          {startMutation.isSuccess && (
            <p className="mt-3 text-sm text-emerald-300">Recherche lancée.</p>
          )}
          {startMutation.isError && (
            <p className="mt-3 text-sm text-rose-300">
              {startMutation.error instanceof Error
                ? startMutation.error.message
                : 'Impossible de lancer la recherche.'}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
