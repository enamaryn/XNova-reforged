'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { researchApi } from '@/lib/api/research';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanetStore } from '@/lib/stores/planet-store';
import { useSocket } from '@/lib/providers/socket-provider';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export default function ResearchClient() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0 },
  };

  const { user } = useAuthStore();
  const { selectedPlanetId, setSelectedPlanetId } = usePlanetStore();
  const { socket } = useSocket();
  const { t } = useI18n();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPlanetId && user?.planets?.length) {
      setSelectedPlanetId(user.planets[0].id);
    }
  }, [user, selectedPlanetId, setSelectedPlanetId]);

  const planetId = selectedPlanetId || user?.planets?.[0]?.id;

  const {
    data: techData,
    isLoading,
    error,
    refetch: refetchTech,
  } = useQuery({
    queryKey: ['technologies', planetId],
    queryFn: () => researchApi.getTechnologies(planetId!),
    enabled: !!planetId,
    refetchInterval: 30000,
  });

  const {
    data: queueData,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ['research-queue'],
    queryFn: () => researchApi.getResearchQueue(),
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: (techId: number) => researchApi.startResearch(planetId!, techId),
    onSuccess: () => {
      refetchTech();
      refetchQueue();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (queueId: string) => researchApi.cancelResearch(queueId),
    onSuccess: () => {
      refetchTech();
      refetchQueue();
    },
  });

  const pushToast = useCallback((message: string) => {
    setToastMessage(message);
    const timeout = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleCompleted = (payload?: { techName?: string; newLevel?: number }) => {
      refetchTech();
      refetchQueue();
      const name = payload?.techName || 'Recherche';
      const level = payload?.newLevel ? ` niv. ${payload.newLevel}` : '';
      pushToast(`Recherche terminée : ${name}${level}`);
    };

    socket.on('research:completed', handleCompleted);

    return () => {
      socket.off('research:completed', handleCompleted);
    };
  }, [socket, refetchTech, refetchQueue, pushToast]);

  if (!planetId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">🧠</div>
          <p className="text-slate-400">Chargement des planètes...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔬</div>
          <p className="text-slate-400">Chargement des technologies...</p>
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
            onClick={() => refetchTech()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const technologies = techData?.technologies || [];
  const queue = queueData || [];
  const grouped = useMemo(() => {
    return technologies.reduce((acc, tech) => {
      acc[tech.category] = acc[tech.category] || [];
      acc[tech.category].push(tech);
      return acc;
    }, {} as Record<string, typeof technologies>);
  }, [technologies]);

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Laboratoire</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Technologies</h1>
        <p className="text-sm text-slate-400">
          Déverrouillez des avantages stratégiques pour vos flottes et infrastructures.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Arbre technologique
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Chemins de recherche
            </h2>
          </div>
          <div className="text-xs text-slate-500">
            Survolez une technologie pour voir les prérequis.
          </div>
        </div>

        <div className="relative mt-6 overflow-x-auto">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:160px_160px]" />
          <motion.div
            variants={shouldReduceMotion ? undefined : listVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'show'}
            className="grid min-w-[720px] grid-cols-4 gap-6"
          >
            {(['basic', 'drive', 'advanced', 'combat'] as const).map((category) => (
              <div key={category} className="space-y-4">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {t(`techCategory.${category}`)}
                </div>
                <motion.div
                  variants={shouldReduceMotion ? undefined : listVariants}
                  initial={shouldReduceMotion ? undefined : 'hidden'}
                  animate={shouldReduceMotion ? undefined : 'show'}
                  className="relative space-y-4"
                >
                  <div className="absolute left-3 top-0 h-full w-px bg-slate-800/80" />
                  {(grouped[category] || []).map((tech) => {
                    const missing = tech.missingRequirements.length > 0;
                    const inQueue = tech.inQueue;
                    const available = tech.canResearch;
                    const isMaxLevel = tech.isMaxLevel;
                    const glow = available && !inQueue;
                    const stateLabel = inQueue
                      ? 'En cours'
                      : isMaxLevel
                        ? 'Niveau max'
                        : missing
                        ? 'Verrouillée'
                        : available
                          ? 'Disponible'
                          : 'Indisponible';

                    return (
                      <motion.div
                        key={tech.id}
                        variants={shouldReduceMotion ? undefined : itemVariants}
                        className="group relative pl-6"
                      >
                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm transition ${
                            inQueue
                              ? 'border-blue-500/50 bg-blue-500/10 text-blue-100'
                              : missing
                                ? 'border-slate-800 bg-slate-900/40 text-slate-400'
                                : 'border-slate-700 bg-slate-900/60 text-slate-200'
                          } ${glow ? 'shadow-[0_0_20px_rgba(59,130,246,0.4)]' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{tech.name}</span>
                            <span className="text-xs text-slate-400">Niv. {tech.currentLevel}</span>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {stateLabel}
                          </div>
                        </div>

                        <div className="pointer-events-none absolute left-0 top-4 h-2 w-2 rounded-full bg-slate-600" />

                        <div className="pointer-events-none absolute left-full top-2 z-10 hidden w-56 -translate-x-2 rounded-xl border border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-300 shadow-xl group-hover:block">
                          <div className="font-semibold text-slate-200">{tech.name}</div>
                          <div className="mt-2 text-slate-500">{tech.description}</div>
                          <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            Prérequis
                          </div>
                          {tech.missingRequirements.length === 0 ? (
                            <div className="mt-1 text-emerald-300">OK</div>
                          ) : (
                            <ul className="mt-1 list-disc list-inside text-slate-400">
                              {tech.missingRequirements.map((req) => (
                                <li key={req}>{req}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="rounded-2xl border border-blue-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Recherche en cours</p>
              <p className="text-xs text-slate-500">
                {queue[0].techName} niv. {queue[0].targetLevel}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Temps restant: {queue[0].remainingSeconds}s
              </p>
            </div>
            <button
              onClick={() => cancelMutation.mutate(queue[0].id)}
              className="text-xs uppercase tracking-[0.2em] text-red-300 hover:text-red-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <motion.div
        variants={shouldReduceMotion ? undefined : listVariants}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        animate={shouldReduceMotion ? undefined : 'show'}
        className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {technologies.map((tech) => (
          <motion.div
            key={tech.id}
            variants={shouldReduceMotion ? undefined : itemVariants}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  {t(`techCategory.${tech.category}`)}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">{tech.name}</h2>
                <p className="mt-2 text-sm text-slate-400 line-clamp-2">
                  {tech.description}
                </p>
              </div>
              <div className="text-3xl">🧬</div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Niveau {tech.currentLevel}</span>
              <span>{Math.max(1, Math.floor(tech.buildTime))}s</span>
            </div>

            {tech.missingRequirements.length > 0 && (
              <div className="mt-3 rounded-xl bg-red-500/10 p-2 text-xs text-red-300">
                <div className="font-semibold mb-1">Prérequis manquants:</div>
                <ul className="list-disc list-inside">
                  {tech.missingRequirements.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {tech.isMaxLevel && (
              <div className="mt-3 rounded-xl bg-slate-800/70 p-2 text-xs text-slate-300">
                Niveau max atteint
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => startMutation.mutate(tech.id)}
                disabled={!tech.canResearch || startMutation.isPending}
                className={`flex-1 rounded-xl py-2 px-4 text-sm font-semibold transition-all duration-200 ${
                  tech.canResearch && !startMutation.isPending
                    ? 'bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {tech.inQueue
                  ? 'En cours'
                  : tech.isMaxLevel
                    ? '⛔ Niveau max atteint'
                    : tech.queueBlocked
                      ? 'File occupée'
                      : 'Lancer la recherche'}
              </button>
              <Link
                href={`/research/${tech.id}`}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Détails
              </Link>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {(startMutation.error || cancelMutation.error) && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-red-500/90 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <p className="text-sm">
            {((startMutation.error || cancelMutation.error) as Error).message}
          </p>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 left-4 max-w-sm rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-200 shadow-lg backdrop-blur-sm">
          <p className="text-sm">{toastMessage}</p>
        </div>
      )}
    </motion.div>
  );
}
