'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { useAuthStore } from '@/lib/stores/auth-store';
import { reportsApi } from '@/lib/api/reports';
import { getSpyReports } from '@/lib/api/fleet';
import { designTokens } from '@/lib/design-tokens';
import { useI18n } from '@/lib/i18n';

function resultKey(result: string) {
  return result === 'attacker_win' || result === 'defender_win' ? result : 'draw';
}

/** Rapports d'espionnage : un par mission d'espionnage arrivée à destination. */
function SpyReportsSection() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['spy-reports'],
    queryFn: () => getSpyReports(),
    refetchInterval: 30000,
  });
  const reports = data ?? [];

  return (
    <section className="space-y-3" data-testid="spy-reports">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{t('reports.spyKicker')}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{t('reports.spyTitle')}</h2>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-400">{t('common.loading')}</p>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-sm text-slate-400">
          {t('reports.spyEmpty')}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/reports/spy/${report.id}`}
              className="block rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 text-sm text-slate-300 transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-100">
                  {report.planetName} [{report.galaxy}:{report.system}:{report.position}]
                </span>
                <span className="text-xs text-slate-500">{new Date(report.createdAt).toLocaleString(locale)}</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {t('reports.spyLine', { probes: report.probes, level: report.infoLevel + 1 })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'draws'>('all');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.getReports(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚔️</div>
          <p className="text-slate-400">{t('reports.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">{t('common.loadError')}</p>
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

  const reports = data ?? [];
  const userId = user?.id;

  const isWin = (report: (typeof reports)[number]) => {
    if (!userId) return false;
    return (
      (report.result === 'attacker_win' && report.attackerId === userId) ||
      (report.result === 'defender_win' && report.defenderId === userId)
    );
  };

  const isLoss = (report: (typeof reports)[number]) => {
    if (!userId) return false;
    return (
      (report.result === 'attacker_win' && report.defenderId === userId) ||
      (report.result === 'defender_win' && report.attackerId === userId)
    );
  };

  const filteredReports = reports.filter((report) => {
    if (filter === 'wins') return isWin(report);
    if (filter === 'losses') return isLoss(report);
    if (filter === 'draws') return report.result === 'draw';
    return true;
  });

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{t('reports.kicker')}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{t('reports.title')}</h1>
        <p className="text-sm text-slate-400">
          {t('reports.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: t('reports.filterAll') },
          { id: 'wins', label: t('reports.filterWins') },
          { id: 'losses', label: t('reports.filterLosses') },
          { id: 'draws', label: t('reports.filterDraws') },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id as typeof filter)}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
              filter === item.id
                ? 'border-red-400/60 bg-red-500/10 text-red-200'
                : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-center">
          <div className="text-3xl mb-2">🛰️</div>
          <p className="text-slate-300">{t('reports.empty')}</p>
          <p className="text-xs text-slate-500 mt-1">
            {t('reports.emptyHint')}
          </p>
        </div>
      ) : (
        <motion.div
          variants={shouldReduceMotion ? undefined : listVariants}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          animate={shouldReduceMotion ? undefined : 'show'}
          className="grid gap-4 lg:grid-cols-2"
        >
          {filteredReports.map((report) => (
            <motion.div
              key={report.id}
              variants={shouldReduceMotion ? undefined : itemVariants}
            >
              <Link
                href={`/reports/${report.id}`}
                className="block rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 text-sm text-slate-300 transition hover:border-slate-600"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {t(`report.result.${resultKey(report.result)}`)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(report.createdAt).toLocaleString(locale)}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {t('reports.attackerLine', { id: report.attackerId })}
                </div>
                <div className="text-xs text-slate-400">
                  {t('reports.defenderLine', { id: report.defenderId })}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      <SpyReportsSection />
    </motion.div>
  );
}
