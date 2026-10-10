'use client';

import { DEFENSES } from '@xnova/game-config';
import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { useI18n } from '@/lib/i18n';
import type { CombatReportDetail } from '@/lib/api/reports';

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

function sumCounts(counts: Record<string, number> | Record<number, number>) {
  return Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function resultKey(result: CombatReportDetail['result']) {
  return result === 'attacker_win' || result === 'defender_win' ? result : 'draw';
}

export const CombatReportCard = memo(function CombatReportCard({
  report,
}: {
  report: CombatReportDetail;
}) {
  const { t, locale } = useI18n();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
      animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
      className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            {t('report.combatTitle')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {t(`report.result.${resultKey(report.result)}`)}
          </h2>
        </div>
        <div className="text-xs text-slate-500">{new Date(report.createdAt).toLocaleString(locale)}</div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-400">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('report.loot')}</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>{t('resources.metal')}</span>
              <span>{formatNumber(report.loot.metal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('resources.crystal')}</span>
              <span>{formatNumber(report.loot.crystal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('resources.deuterium')}</span>
              <span>{formatNumber(report.loot.deuterium)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('report.debris')}</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>{t('resources.metal')}</span>
              <span>{formatNumber(report.debris.metal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('resources.crystal')}</span>
              <span>{formatNumber(report.debris.crystal)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('report.summary')}</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>{t('report.rounds')}</span>
              <span>{report.rounds}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('report.attacker')}</span>
              <span>{report.attackerId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('report.defender')}</span>
              <span>{report.defenderId}</span>
            </div>
          </div>
        </div>

        {report.defenderDefs && sumCounts(report.defenderDefs) > 0 && (
          <div
            className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4"
            data-testid="report-defenses"
          >
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('report.defenses')}</h3>
            <div className="mt-3 grid gap-2 text-xs text-slate-300">
              {Object.entries(report.defenderDefs).map(([id, count]) => {
                const destroyed = report.defenderLosses?.[id] ?? 0;
                const repaired = report.defenderRepaired?.[id] ?? 0;
                return (
                  <div key={id} className="flex items-center justify-between">
                    <span>{DEFENSES[Number(id)]?.name ?? t('report.defenseFallback', { id })}</span>
                    <span>
                      {t('report.defenseLine', {
                        count: formatNumber(count),
                        destroyed: formatNumber(destroyed),
                        repaired: formatNumber(repaired),
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {report.timeline && report.timeline.length > 0 && (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('report.timeline')}</h3>
            <div className="mt-3 space-y-2 text-xs text-slate-300">
              {report.timeline.map((round) => {
                const attackerRemaining = sumCounts(round.attackerRemaining);
                const defenderRemaining = sumCounts(round.defenderRemaining);
                const attackerLosses = sumCounts(round.attackerLosses);
                const defenderLosses = sumCounts(round.defenderLosses);

                return (
                  <div key={round.round} className="flex items-center justify-between">
                    <span>{t('report.round', { round: round.round })}</span>
                    <span className="text-slate-400">
                      A {attackerRemaining} (-{attackerLosses}) • D {defenderRemaining} (-{defenderLosses})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

CombatReportCard.displayName = 'CombatReportCard';
