'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { getStatistics } from '@/lib/api/statistics';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export default function StatisticsPage() {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['statistics'],
    queryFn: getStatistics,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">📊</div>
          <p className="text-slate-400">{t('statistics.loading')}</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">{t('common.error')}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { personal, topPlayers, topAlliances } = data;

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {t('statistics.kicker')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {t('statistics.title')}
        </h1>
        <p className="text-sm text-slate-400">{t('statistics.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">
            {t('statistics.personal')}
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('statistics.playerRank')}</span>
              <span className="text-slate-200">#{personal.rank}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('statistics.points')}</span>
              <span className="text-slate-200">{personal.points}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('statistics.planets')}</span>
              <span className="text-slate-200">{personal.planets}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('statistics.alliance')}</span>
              <span className="text-slate-200">
                {personal.alliance
                  ? `[${personal.alliance.tag}] ${personal.alliance.name}`
                  : t('statistics.none')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-white">
              {t('statistics.topPlayers')}
            </h2>
            {topPlayers.length === 0 ? (
              <div className="mt-4 text-xs text-slate-500">
                {t('statistics.emptyPlayers')}
              </div>
            ) : (
              <motion.div
                variants={shouldReduceMotion ? undefined : listVariants}
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'show'}
                className="mt-4 space-y-2"
              >
                {topPlayers.map((player, index) => (
                  <motion.div
                    key={player.id}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                    className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                      <span className="text-slate-200">{player.username}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {player.points} {t('statistics.points')}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-white">
              {t('statistics.topAlliances')}
            </h2>
            {topAlliances.length === 0 ? (
              <div className="mt-4 text-xs text-slate-500">
                {t('statistics.emptyAlliances')}
              </div>
            ) : (
              <motion.div
                variants={shouldReduceMotion ? undefined : listVariants}
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'show'}
                className="mt-4 space-y-2"
              >
                {topAlliances.map((alliance, index) => (
                  <motion.div
                    key={alliance.id}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                    className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                      <div>
                        <div className="text-slate-200">
                          [{alliance.tag}] {alliance.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {alliance.members} {t('statistics.members')}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {alliance.points} {t('statistics.points')}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
