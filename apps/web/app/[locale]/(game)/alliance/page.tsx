'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import {
  createAlliance,
  getMyAlliance,
  inviteAllianceMember,
  joinAlliance,
  leaveAlliance,
} from '@/lib/api/alliances';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export default function AlliancePage() {
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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [createForm, setCreateForm] = useState({
    tag: '',
    name: '',
    description: '',
  });
  const [joinId, setJoinId] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');

  const allianceQuery = useQuery({
    queryKey: ['alliance', 'me'],
    queryFn: getMyAlliance,
  });

  const createMutation = useMutation({
    mutationFn: createAlliance,
    onSuccess: () => {
      setCreateForm({ tag: '', name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['alliance', 'me'] });
    },
  });

  const joinMutation = useMutation({
    mutationFn: (allianceId: string) => joinAlliance(allianceId),
    onSuccess: () => {
      setJoinId('');
      queryClient.invalidateQueries({ queryKey: ['alliance', 'me'] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ allianceId, username }: { allianceId: string; username: string }) =>
      inviteAllianceMember(allianceId, { username }),
    onSuccess: () => {
      setInviteUsername('');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (allianceId: string) => leaveAlliance(allianceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alliance', 'me'] });
    },
  });

  if (allianceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🤝</div>
          <p className="text-slate-400">{t('alliance.loading')}</p>
        </div>
      </div>
    );
  }

  if (allianceQuery.isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">{t('common.error')}</p>
          <button
            onClick={() => allianceQuery.refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const membership = allianceQuery.data;
  const alliance = membership?.alliance ?? null;
  const isFounder = alliance?.founderId === user?.id;

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {t('alliance.kicker')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {t('alliance.title')}
        </h1>
        <p className="text-sm text-slate-400">{t('alliance.subtitle')}</p>
      </div>

      {alliance ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  [{alliance.tag}]
                </div>
                <h2 className="text-xl font-semibold text-white">{alliance.name}</h2>
                <p className="text-xs text-slate-500">
                  {t('alliance.createdAt')} {new Date(alliance.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                {membership?.rank}
              </div>
            </div>

            {alliance.description && (
              <p className="mt-3 text-sm text-slate-300 whitespace-pre-line">
                {alliance.description}
              </p>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {t('alliance.members')}
                </h3>
                <span className="text-xs text-slate-500">
                  {alliance.members.length} {t('alliance.players')}
                </span>
              </div>
              <motion.div
                variants={shouldReduceMotion ? undefined : listVariants}
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'show'}
                className="mt-3 grid gap-2"
              >
                {alliance.members.map((member) => (
                  <motion.div
                    key={member.id}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                    className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="text-slate-200">{member.user.username}</div>
                      <div className="text-xs text-slate-500">
                        {t('alliance.points')} {member.user.points}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {member.rank}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
              <h3 className="text-sm font-semibold text-white">
                {t('alliance.invite')}
              </h3>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  placeholder={t('alliance.invitePlaceholder')}
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                />
                <button
                  onClick={() =>
                    alliance &&
                    inviteUsername &&
                    inviteMutation.mutate({ allianceId: alliance.id, username: inviteUsername })
                  }
                  disabled={inviteMutation.isPending}
                  className="w-full rounded-full border border-blue-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/10 disabled:opacity-60 sm:w-auto"
                >
                  {inviteMutation.isPending
                    ? t('alliance.inviting')
                    : t('alliance.inviteAction')}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
              <h3 className="text-sm font-semibold text-white">
                {t('alliance.leave')}
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                {isFounder ? t('alliance.leaveBlocked') : t('alliance.leaveHint')}
              </p>
              <button
                onClick={() => alliance && leaveMutation.mutate(alliance.id)}
                disabled={isFounder || leaveMutation.isPending}
                className="mt-4 rounded-full border border-red-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-red-200 hover:bg-red-500/10 disabled:opacity-60"
              >
                {leaveMutation.isPending
                  ? t('alliance.leaving')
                  : t('alliance.leaveAction')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-white">
              {t('alliance.create')}
            </h2>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder={t('alliance.tagPlaceholder')}
                value={createForm.tag}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, tag: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <input
                type="text"
                placeholder={t('alliance.namePlaceholder')}
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <textarea
                placeholder={t('alliance.descriptionPlaceholder')}
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={5}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <button
                onClick={() => createMutation.mutate(createForm)}
                disabled={createMutation.isPending}
                className="w-full rounded-full border border-emerald-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
              >
                {createMutation.isPending
                  ? t('alliance.creating')
                  : t('alliance.createAction')}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-white">
              {t('alliance.join')}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              {t('alliance.joinHint')}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder={t('alliance.joinPlaceholder')}
                value={joinId}
                onChange={(event) => setJoinId(event.target.value)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <button
                onClick={() => joinId && joinMutation.mutate(joinId)}
                disabled={joinMutation.isPending}
                className="w-full rounded-full border border-blue-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/10 disabled:opacity-60 sm:w-auto"
              >
                {joinMutation.isPending
                  ? t('alliance.joining')
                  : t('alliance.joinAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
