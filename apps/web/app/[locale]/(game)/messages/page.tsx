'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import {
  deleteMessage,
  getInbox,
  getMessage,
  sendMessage,
} from '@/lib/api/messages';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export default function MessagesPage() {
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

  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    toUsername: '',
    subject: '',
    body: '',
  });

  const inboxQuery = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: getInbox,
  });

  const messageQuery = useQuery({
    queryKey: ['messages', selectedId],
    queryFn: () => getMessage(selectedId!),
    enabled: Boolean(selectedId),
  });

  // Invalidate inbox when message is successfully fetched
  useEffect(() => {
    if (messageQuery.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
    }
  }, [messageQuery.isSuccess, queryClient]);

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      setForm({ toUsername: '', subject: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
    },
  });

  const inbox = inboxQuery.data ?? [];
  const selectedMessage =
    messageQuery.data ??
    (selectedId ? inbox.find((item) => item.id === selectedId) : null);

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.toUsername || !form.subject || !form.body) {
      return;
    }
    sendMutation.mutate(form);
  };

  if (inboxQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">✉️</div>
          <p className="text-slate-400">{t('messages.loading')}</p>
        </div>
      </div>
    );
  }

  if (inboxQuery.isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 mb-4">{t('common.error')}</p>
          <button
            onClick={() => inboxQuery.refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {t('messages.kicker')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {t('messages.title')}
        </h1>
        <p className="text-sm text-slate-400">{t('messages.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              {t('messages.inbox')}
            </h2>
            <span className="text-xs text-slate-500">
              {inbox.length} {t('messages.items')}
            </span>
          </div>

          {inbox.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-center">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-slate-300">{t('messages.empty')}</p>
              <p className="text-xs text-slate-500 mt-1">
                {t('messages.emptyHint')}
              </p>
            </div>
          ) : (
            <motion.div
              variants={shouldReduceMotion ? undefined : listVariants}
              initial={shouldReduceMotion ? undefined : 'hidden'}
              animate={shouldReduceMotion ? undefined : 'show'}
              className="mt-4 grid gap-2"
            >
              {inbox.map((message) => (
                <motion.button
                  key={message.id}
                  variants={shouldReduceMotion ? undefined : itemVariants}
                  onClick={() => setSelectedId(message.id)}
                  className={`text-left rounded-2xl border px-4 py-3 transition ${
                    selectedId === message.id
                      ? 'border-blue-500/60 bg-blue-500/10'
                      : 'border-slate-800/70 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs uppercase tracking-[0.2em] ${
                        message.read ? 'text-slate-500' : 'text-emerald-300'
                      }`}
                    >
                      {message.read ? t('messages.read') : t('messages.unread')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-200">
                    {message.subject}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t('messages.from')} {message.from.username}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {message.body.slice(0, 120)}
                    {message.body.length > 120 ? '...' : ''}
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-white">
              {t('messages.compose')}
            </h2>
            <form onSubmit={handleSend} className="mt-4 space-y-3">
              <input
                type="text"
                placeholder={t('messages.toPlaceholder')}
                value={form.toUsername}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, toUsername: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <input
                type="text"
                placeholder={t('messages.subjectPlaceholder')}
                value={form.subject}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, subject: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <textarea
                placeholder={t('messages.bodyPlaceholder')}
                value={form.body}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, body: event.target.value }))
                }
                rows={5}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
              />
              <button
                type="submit"
                disabled={sendMutation.isPending}
                className="w-full rounded-full border border-blue-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/10 disabled:opacity-60"
              >
                {sendMutation.isPending
                  ? t('messages.sending')
                  : t('messages.send')}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h2 className="text-sm font-semibold text-white">
              {t('messages.detail')}
            </h2>
            {selectedMessage ? (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="text-xs text-slate-500">
                  {new Date(selectedMessage.createdAt).toLocaleString()}
                </div>
                <div className="text-base font-semibold text-white">
                  {selectedMessage.subject}
                </div>
                <div className="text-xs text-slate-400">
                  {t('messages.from')} {selectedMessage.from.username}
                </div>
                <p className="whitespace-pre-line text-sm text-slate-300">
                  {selectedMessage.body}
                </p>
                <button
                  onClick={() => deleteMutation.mutate(selectedMessage.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-full border border-red-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                >
                  {deleteMutation.isPending
                    ? t('messages.deleting')
                    : t('messages.delete')}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 text-xs text-slate-500">
                {t('messages.selectHint')}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
