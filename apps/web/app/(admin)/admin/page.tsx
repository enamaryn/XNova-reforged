'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminConfig,
  getAdminOverview,
  updateAdminConfig,
  type AdminConfig,
  getAuditLogs,
  getBanLogs,
  updateUserRole,
  banUser,
  unbanUser,
  boostDevelopment,
  type BoostDevelopmentResult,
} from '@/lib/api/admin';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/stores/auth-store';
import { isSuperAdmin } from '@/lib/roles';

export default function AdminPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isSuperAdminUser = isSuperAdmin(user?.role);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminConfig | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [roleForm, setRoleForm] = useState({ username: '', role: 'MODERATOR' });
  const [banForm, setBanForm] = useState({
    username: '',
    reason: '',
    days: 0,
    hours: 0,
    minutes: 0,
  });
  const [unbanForm, setUnbanForm] = useState({ username: '', reason: '' });
  const [boostForm, setBoostForm] = useState({ username: '' });
  const [boostResult, setBoostResult] = useState<BoostDevelopmentResult | null>(null);

  const configQuery = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: getAdminConfig,
  });

  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: getAdminOverview,
  });

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => getAuditLogs(25),
  });

  const banLogsQuery = useQuery({
    queryKey: ['admin', 'ban-logs'],
    queryFn: () => getBanLogs(25),
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

  const roleMutation = useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => {
      setRoleForm({ username: '', role: 'MODERATOR' });
      auditQuery.refetch();
    },
  });

  const banMutation = useMutation({
    mutationFn: banUser,
    onSuccess: () => {
      setBanForm({ username: '', reason: '', days: 0, hours: 0, minutes: 0 });
      banLogsQuery.refetch();
      auditQuery.refetch();
    },
  });

  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onSuccess: () => {
      setUnbanForm({ username: '', reason: '' });
      banLogsQuery.refetch();
      auditQuery.refetch();
    },
  });

  const boostMutation = useMutation({
    mutationFn: boostDevelopment,
    onSuccess: (data) => {
      setBoostForm({ username: '' });
      setBoostResult(data);
      auditQuery.refetch();
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
            {t('admin.buildingCostMultiplier')}
            <input
              type="number"
              step="0.1"
              value={form.buildingCostMultiplier}
              onChange={(event) =>
                handleChange('buildingCostMultiplier')(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.researchCostMultiplier')}
            <input
              type="number"
              step="0.1"
              value={form.researchCostMultiplier}
              onChange={(event) =>
                handleChange('researchCostMultiplier')(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.shipCostMultiplier')}
            <input
              type="number"
              step="0.1"
              value={form.shipCostMultiplier}
              onChange={(event) =>
                handleChange('shipCostMultiplier')(event.target.value)
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
            {t('admin.maxBuildingLevel')}
            <input
              type="number"
              step="1"
              value={form.maxBuildingLevel}
              onChange={(event) => handleChange('maxBuildingLevel')(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t('admin.maxTechnologyLevel')}
            <input
              type="number"
              step="1"
              value={form.maxTechnologyLevel}
              onChange={(event) => handleChange('maxTechnologyLevel')(event.target.value)}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('admin.roleTitle')}</h2>
          <p className="text-xs text-slate-500">{t('admin.roleHint')}</p>
          <div className="mt-4 space-y-3">
            <input
              type="text"
              placeholder={t('admin.usernamePlaceholder')}
              value={roleForm.username}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, username: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            />
            <select
              value={roleForm.role}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, role: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            >
              <option value="PLAYER">{t('admin.rolePlayer')}</option>
              <option value="MODERATOR">{t('admin.roleModerator')}</option>
              <option value="ADMIN">{t('admin.roleAdmin')}</option>
              <option value="SUPER_ADMIN">{t('admin.roleSuperAdmin')}</option>
            </select>
            <button
              onClick={() =>
                roleForm.username &&
                roleMutation.mutate({
                  username: roleForm.username,
                  role: roleForm.role as 'PLAYER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN',
                })
              }
              disabled={roleMutation.isPending}
              className="w-full rounded-full border border-blue-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/10 disabled:opacity-60"
            >
              {roleMutation.isPending ? t('admin.roleUpdating') : t('admin.roleUpdate')}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('admin.moderationTitle')}</h2>
          <p className="text-xs text-slate-500">{t('admin.moderationHint')}</p>
          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              <input
                type="text"
                placeholder={t('admin.usernamePlaceholder')}
                value={banForm.username}
                onChange={(event) =>
                  setBanForm((prev) => ({ ...prev, username: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <input
                type="text"
                placeholder={t('admin.reasonPlaceholder')}
                value={banForm.reason}
                onChange={(event) =>
                  setBanForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={0}
                  value={banForm.days}
                  onChange={(event) =>
                    setBanForm((prev) => ({ ...prev, days: Number(event.target.value) }))
                  }
                  placeholder={t('admin.days')}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                />
                <input
                  type="number"
                  min={0}
                  value={banForm.hours}
                  onChange={(event) =>
                    setBanForm((prev) => ({ ...prev, hours: Number(event.target.value) }))
                  }
                  placeholder={t('admin.hours')}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                />
                <input
                  type="number"
                  min={0}
                  value={banForm.minutes}
                  onChange={(event) =>
                    setBanForm((prev) => ({ ...prev, minutes: Number(event.target.value) }))
                  }
                  placeholder={t('admin.minutes')}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                />
              </div>
              <button
                onClick={() =>
                  banForm.username &&
                  banMutation.mutate({
                    username: banForm.username,
                    reason: banForm.reason || undefined,
                    days: banForm.days || undefined,
                    hours: banForm.hours || undefined,
                    minutes: banForm.minutes || undefined,
                  })
                }
                disabled={banMutation.isPending}
                className="w-full rounded-full border border-red-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-red-200 hover:bg-red-500/10 disabled:opacity-60"
              >
                {banMutation.isPending ? t('admin.banProcessing') : t('admin.banAction')}
              </button>
            </div>

            <div className="border-t border-slate-800/70 pt-4 space-y-3">
              <input
                type="text"
                placeholder={t('admin.usernamePlaceholder')}
                value={unbanForm.username}
                onChange={(event) =>
                  setUnbanForm((prev) => ({ ...prev, username: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <input
                type="text"
                placeholder={t('admin.reasonPlaceholder')}
                value={unbanForm.reason}
                onChange={(event) =>
                  setUnbanForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <button
                onClick={() =>
                  unbanForm.username &&
                  unbanMutation.mutate({
                    username: unbanForm.username,
                    reason: unbanForm.reason || undefined,
                  })
                }
                disabled={unbanMutation.isPending}
                className="w-full rounded-full border border-emerald-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
              >
                {unbanMutation.isPending ? t('admin.unbanProcessing') : t('admin.unbanAction')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isSuperAdminUser && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('admin.boostTitle')}</h2>
          <p className="text-xs text-slate-500">{t('admin.boostHint')}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t('admin.usernameLabel')}
              <input
                type="text"
                placeholder={t('admin.usernamePlaceholder')}
                value={boostForm.username}
                onChange={(event) => {
                  setBoostResult(null);
                  setBoostForm((prev) => ({ ...prev, username: event.target.value }));
                }}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
            </label>
            <button
              onClick={() =>
                boostForm.username &&
                boostMutation.mutate({ username: boostForm.username })
              }
              disabled={boostMutation.isPending}
              className="rounded-full border border-amber-500/60 px-5 py-2 text-xs uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-500/10 disabled:opacity-60"
            >
              {boostMutation.isPending ? t('admin.boostProcessing') : t('admin.boostAction')}
            </button>
          </div>
          {boostResult && (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
              <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                {t('admin.boostSuccess')}
              </div>
              <div className="mt-2 text-sm text-emerald-100">
                {boostResult.username} • {boostResult.planetsUpdated} {t('admin.boostPlanets')} •{' '}
                {boostResult.technologiesUpdated} {t('admin.boostTechs')} •{' '}
                {t('admin.boostBuildingLevel')} {boostResult.buildingLevel} •{' '}
                {t('admin.boostTechnologyLevel')} {boostResult.technologyLevel}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('admin.auditTitle')}</h2>
          <p className="text-xs text-slate-500">{t('admin.auditHint')}</p>
          <div className="mt-4 space-y-2 text-xs text-slate-400">
            {(auditQuery.data ?? []).length === 0 ? (
              <div>{t('admin.auditEmpty')}</div>
            ) : (
              auditQuery.data?.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{entry.action}</span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {t('admin.by')} {entry.user.username}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('admin.banTitle')}</h2>
          <p className="text-xs text-slate-500">{t('admin.banHint')}</p>
          <div className="mt-4 space-y-2 text-xs text-slate-400">
            {(banLogsQuery.data ?? []).length === 0 ? (
              <div>{t('admin.banEmpty')}</div>
            ) : (
              banLogsQuery.data?.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">
                      {entry.action.toUpperCase()} {entry.user.username}
                    </span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {t('admin.by')} {entry.actor.username}
                    {entry.expiresAt && ` • ${t('admin.expiresAt')} ${new Date(entry.expiresAt).toLocaleString()}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
