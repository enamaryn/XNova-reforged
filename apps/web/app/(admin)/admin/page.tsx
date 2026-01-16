'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminConfig,
  getAdminOverview,
  updateAdminConfig,
  type AdminConfig,
} from '@/lib/api/admin';
import { useI18n } from '@/lib/i18n';

export default function AdminPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminConfig | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const configQuery = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: getAdminConfig,
  });

  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: getAdminOverview,
  });

  useEffect(() => {
    if (configQuery.data) {
      setForm(configQuery.data);
    }
  }, [configQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateAdminConfig,
    onSuccess: (data) => {
      setForm(data);
      setSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
  });

  const handleChange = (key: keyof AdminConfig) => (value: string) => {
    const numericValue = Number(value);
    setForm((prev) =>
      prev
        ? {
            ...prev,
            [key]: Number.isNaN(numericValue) ? prev[key] : numericValue,
          }
        : prev,
    );
  };

  const overviewCards = useMemo(() => {
    if (!overviewQuery.data) return [];
    return [
      { label: t('admin.players'), value: overviewQuery.data.players },
      { label: t('admin.online'), value: overviewQuery.data.onlinePlayers },
      { label: t('admin.planets'), value: overviewQuery.data.planets },
      { label: t('admin.alliances'), value: overviewQuery.data.alliances },
    ];
  }, [overviewQuery.data, t]);

  if (configQuery.isLoading || overviewQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🛠️</div>
          <p className="text-slate-400">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  if (configQuery.isError || overviewQuery.isError || !form) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {t('common.error')}
        <button
          onClick={() => {
            configQuery.refetch();
            overviewQuery.refetch();
          }}
          className="ml-4 rounded-full border border-red-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-red-200 hover:bg-red-500/10"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{t('admin.overview')}</h2>
            <p className="text-xs text-slate-500">{t('admin.overviewHint')}</p>
          </div>
          {overviewQuery.data?.serverTime && (
            <span className="text-xs text-slate-500">
              {new Date(overviewQuery.data.serverTime).toLocaleString()}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overviewCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {card.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{t('admin.config')}</h2>
            <p className="text-xs text-slate-500">{t('admin.configHint')}</p>
          </div>
          {savedAt && (
            <span className="text-xs text-emerald-400">
              {t('admin.savedAt')} {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.gameSpeed')}
            <input
              type="number"
              step="0.1"
              value={form.gameSpeed}
              onChange={(event) => handleChange('gameSpeed')(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.fleetSpeed')}
            <input
              type="number"
              step="0.1"
              value={form.fleetSpeed}
              onChange={(event) => handleChange('fleetSpeed')(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.productionSpeed')}
            <input
              type="number"
              step="0.1"
              value={form.resourceMultiplier}
              onChange={(event) =>
                handleChange('resourceMultiplier')(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.planetSize')}
            <input
              type="number"
              step="1"
              value={form.planetSize}
              onChange={(event) => handleChange('planetSize')(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.baseMetal')}
            <input
              type="number"
              step="1"
              value={form.baseMetal}
              onChange={(event) => handleChange('baseMetal')(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.baseCrystal')}
            <input
              type="number"
              step="1"
              value={form.baseCrystal}
              onChange={(event) => handleChange('baseCrystal')(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.baseDeuterium')}
            <input
              type="number"
              step="1"
              value={form.baseDeuterium}
              onChange={(event) =>
                handleChange('baseDeuterium')(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
            className="rounded-full border border-emerald-500/60 px-5 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
          >
            {updateMutation.isPending ? t('admin.saving') : t('admin.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
