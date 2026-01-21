'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { reportsApi } from '@/lib/api/reports';
import { CombatReportCard } from '@/components/game/CombatReportCard';
import { designTokens } from '@/lib/design-tokens';

export function ReportDetailClient({ reportId }: { reportId: string }) {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => reportsApi.getReport(reportId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚔️</div>
          <p className="text-slate-400">Chargement du rapport...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">Rapport introuvable</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <Link href="/reports" className="text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300">
        ← Retour aux rapports
      </Link>
      <CombatReportCard report={data} />
    </motion.div>
  );
}
