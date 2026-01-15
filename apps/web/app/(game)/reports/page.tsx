'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { reportsApi } from '@/lib/api/reports';

function formatResult(result: string) {
  switch (result) {
    case 'attacker_win':
      return 'Victoire attaquant';
    case 'defender_win':
      return 'Victoire défenseur';
    default:
      return 'Match nul';
  }
}

export default function ReportsPage() {
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
          <p className="text-slate-400">Chargement des rapports...</p>
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
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Réessayer
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
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Combat</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Rapports</h1>
        <p className="text-sm text-slate-400">
          Historique des affrontements et résultats récents.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Tous' },
          { id: 'wins', label: 'Gagnés' },
          { id: 'losses', label: 'Perdus' },
          { id: 'draws', label: 'Nuls' },
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
          <p className="text-slate-300">Aucun rapport disponible</p>
          <p className="text-xs text-slate-500 mt-1">
            Lancez une attaque pour générer votre premier rapport.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredReports.map((report) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 text-sm text-slate-300 transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {formatResult(report.result)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(report.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Attaquant: {report.attackerId}
              </div>
              <div className="text-xs text-slate-400">
                Défenseur: {report.defenderId}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
