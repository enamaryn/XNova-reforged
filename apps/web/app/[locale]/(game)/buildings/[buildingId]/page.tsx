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
import { useI18n } from '@/lib/i18n';
import { BuildingUpgradeEffects } from '@/components/game/BuildingUpgradeEffects';

export default function BuildingDetailPage() {
  const { t } = useI18n();
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
    refetchInterval: 30000,
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
        {t('buildings.selectPlanet')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
        {t('buildings.loadingOne')}
      </div>
    );
  }

  if (!building) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
          {t('buildings.notFound')}
        </div>
        <Link
          href="/buildings"
          className="text-sm text-blue-300 hover:text-blue-200"
        >
          {t('buildings.backToList')}
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
            {t('buildings.one')}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{building.name}</h1>
          <p className="text-sm text-slate-400">
            {t('buildings.currentLevelLine', { level: building.currentLevel })}
          </p>
        </div>
        <Link
          href="/buildings"
          className="rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-white"
        >
          {t('common.back')}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <p className="text-sm text-slate-300">{building.description}</p>
          <div className="mt-6">
            <BuildingUpgradeEffects building={building} detailed />
          </div>
          <div className="mt-6 grid gap-3 text-sm text-slate-400">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>{t('buildings.buildTime')}</span>
              <span className="font-mono text-slate-200">{building.buildTime}s</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>{t('common.category')}</span>
              <span className="font-mono text-slate-200">{getCategoryLabel(building.category, t)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-500">
            {t('buildings.costs')}
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>{t('resources.metal')}</span>
              <span className="font-mono text-amber-300">{building.cost.metal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>{t('resources.crystal')}</span>
              <span className="font-mono text-sky-300">{building.cost.crystal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>{t('resources.deuterium')}</span>
              <span className="font-mono text-blue-300">{building.cost.deuterium}</span>
            </div>
          </div>

          {building.missingRequirements.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
              <p className="mb-2 font-semibold">{t('buildings.missingNoColon')}</p>
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
              ? t('buildings.alreadyBuilding')
              : buildMutation.isPending
                ? t('buildings.building')
                : t('buildings.buildLevel', { level: building.currentLevel + 1 })}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function getCategoryLabel(category: string, t: (key: string) => string): string {
  const known = ['resource', 'facility', 'station', 'defense', 'moon'];
  return known.includes(category) ? t(`buildings.category.${category}`) : category;
}
