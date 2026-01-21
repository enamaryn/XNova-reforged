'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import type { CombatReportDetail } from '@/lib/api/reports';

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

function sumCounts(counts: Record<string, number> | Record<number, number>) {
  return Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function formatResult(result: CombatReportDetail['result']) {
  switch (result) {
    case 'attacker_win':
      return 'Victoire attaquant';
    case 'defender_win':
      return 'Victoire défenseur';
    default:
      return 'Match nul';
  }
}

export const CombatReportCard = memo(function CombatReportCard({
  report,
}: {
  report: CombatReportDetail;
}) {
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
            Rapport de combat
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {formatResult(report.result)}
          </h2>
        </div>
        <div className="text-xs text-slate-500">{new Date(report.createdAt).toLocaleString()}</div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-400">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Butin</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Métal</span>
              <span>{formatNumber(report.loot.metal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cristal</span>
              <span>{formatNumber(report.loot.crystal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deutérium</span>
              <span>{formatNumber(report.loot.deuterium)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Débris</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Métal</span>
              <span>{formatNumber(report.debris.metal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cristal</span>
              <span>{formatNumber(report.debris.crystal)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Résumé</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Rounds</span>
              <span>{report.rounds}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Attaquant</span>
              <span>{report.attackerId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Défenseur</span>
              <span>{report.defenderId}</span>
            </div>
          </div>
        </div>

        {report.timeline && report.timeline.length > 0 && (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Chronologie</h3>
            <div className="mt-3 space-y-2 text-xs text-slate-300">
              {report.timeline.map((round) => {
                const attackerRemaining = sumCounts(round.attackerRemaining);
                const defenderRemaining = sumCounts(round.defenderRemaining);
                const attackerLosses = sumCounts(round.attackerLosses);
                const defenderLosses = sumCounts(round.defenderLosses);

                return (
                  <div key={round.round} className="flex items-center justify-between">
                    <span>Tour {round.round}</span>
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
