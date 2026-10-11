'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSmtpSettings,
  sendSmtpTest,
  updateSmtpSettings,
  type SmtpSettings,
  type UpdateSmtpPayload,
} from '@/lib/api/admin';
import { useI18n } from '@/lib/i18n';

const inputClass =
  'w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60';
const labelClass = 'block text-xs uppercase tracking-[0.2em] text-slate-500';

interface FormState {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  password: string;
  clearPassword: boolean;
}

function toForm(settings: SmtpSettings): FormState {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: String(settings.port),
    secure: settings.secure,
    username: settings.username,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    password: '',
    clearPassword: false,
  };
}

/** Onglet « Configurer SMTP » : réservé au super admin (l'API refuse tout autre rôle). */
export function SmtpSettingsPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [testTo, setTestTo] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const query = useQuery({ queryKey: ['admin-smtp'], queryFn: getSmtpSettings });

  useEffect(() => {
    if (query.data && !form) setForm(toForm(query.data));
  }, [query.data, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateSmtpPayload) => updateSmtpSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin-smtp'], saved);
      setForm(toForm(saved));
      setNotice({ kind: 'ok', text: t('admin.smtp.saved') });
    },
    onError: (error: Error) => setNotice({ kind: 'error', text: error.message }),
  });

  const testMutation = useMutation({
    mutationFn: () => sendSmtpTest(testTo.trim() || undefined),
    onSuccess: (result) =>
      setNotice({ kind: 'ok', text: t('admin.smtp.testSent', { to: result.to }) }),
    onError: (error: Error) => setNotice({ kind: 'error', text: error.message }),
  });

  if (query.isLoading || !form) {
    return <p className="text-sm text-slate-400">{t('admin.smtp.loading')}</p>;
  }

  if (query.isError) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {t('admin.smtp.loadError')}
        <button onClick={() => query.refetch()} className="ml-4 underline">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const settings = query.data!;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setNotice(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: UpdateSmtpPayload = {
      enabled: form.enabled,
      host: form.host.trim(),
      port: Number(form.port),
      secure: form.secure,
      username: form.username.trim(),
      fromEmail: form.fromEmail.trim(),
      fromName: form.fromName.trim(),
    };
    if (form.password) payload.password = form.password;
    if (form.clearPassword && !form.password) payload.clearPassword = true;
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6" data-testid="smtp-panel">
      <form
        onSubmit={submit}
        className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6"
      >
        <h2 className="text-sm font-semibold text-white">{t('admin.smtp.title')}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t('admin.smtp.intro')}
        </p>

        <label className="mt-5 flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => set('enabled', event.target.checked)}
            aria-label={t('admin.smtp.enable')}
          />
          {t('admin.smtp.enable')}
        </label>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClass}>{t('admin.smtp.host')}</span>
            <input
              className={inputClass}
              value={form.host}
              onChange={(event) => set('host', event.target.value)}
              placeholder="smtp.example.org"
              aria-label={t('admin.smtp.hostAria')}
            />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>{t('admin.smtp.port')}</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => set('port', event.target.value)}
              aria-label={t('admin.smtp.portAria')}
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-200 md:col-span-2">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(event) => set('secure', event.target.checked)}
              aria-label={t('admin.smtp.secureAria')}
            />
            {t('admin.smtp.secure')}
          </label>
          <label className="space-y-1">
            <span className={labelClass}>{t('admin.smtp.username')}</span>
            <input
              className={inputClass}
              value={form.username}
              onChange={(event) => set('username', event.target.value)}
              autoComplete="off"
              aria-label={t('admin.smtp.usernameAria')}
            />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>{t('admin.smtp.password')}</span>
            <input
              className={inputClass}
              type="password"
              value={form.password}
              onChange={(event) => set('password', event.target.value)}
              autoComplete="new-password"
              placeholder={settings.passwordSet ? t('admin.smtp.passwordKept') : t('admin.smtp.passwordNone')}
              aria-label={t('admin.smtp.passwordAria')}
            />
            {settings.passwordUnreadable && (
              <span className="block text-xs text-amber-300">
                {t('admin.smtp.passwordUnreadable')}
              </span>
            )}
            {(settings.passwordSet || settings.passwordUnreadable) && (
              <label className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={form.clearPassword}
                  onChange={(event) => set('clearPassword', event.target.checked)}
                />
                {t('admin.smtp.passwordClear')}
              </label>
            )}
          </label>
          <label className="space-y-1">
            <span className={labelClass}>{t('admin.smtp.fromEmail')}</span>
            <input
              className={inputClass}
              type="email"
              value={form.fromEmail}
              onChange={(event) => set('fromEmail', event.target.value)}
              placeholder="jeu@example.org"
              aria-label={t('admin.smtp.fromEmailAria')}
            />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>{t('admin.smtp.fromName')}</span>
            <input
              className={inputClass}
              value={form.fromName}
              onChange={(event) => set('fromName', event.target.value)}
              aria-label={t('admin.smtp.fromNameAria')}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-full border border-blue-500/60 bg-blue-500/10 px-5 py-2 text-xs uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
          >
            {saveMutation.isPending ? t('admin.smtp.saving') : t('admin.smtp.save')}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
        <h2 className="text-sm font-semibold text-white">{t('admin.smtp.testTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t('admin.smtp.testHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            className={`${inputClass} max-w-sm`}
            type="email"
            value={testTo}
            onChange={(event) => setTestTo(event.target.value)}
            placeholder={t('admin.smtp.testPlaceholder')}
            aria-label={t('admin.smtp.testAria')}
          />
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              testMutation.mutate();
            }}
            disabled={testMutation.isPending}
            className="rounded-full border border-slate-700 px-5 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 hover:border-slate-500 disabled:opacity-50"
          >
            {testMutation.isPending ? t('admin.smtp.testSending') : t('admin.smtp.testSend')}
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          data-testid="smtp-notice"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
