'use client';

import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export default function SettingsPage() {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {t('settings.kicker')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-slate-400">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('settings.account')}</h2>
          <p className="mt-2 text-xs text-slate-500">
            {t('settings.accountHint')}
          </p>
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-300">
            {t('settings.accountTodo')}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">{t('settings.interface')}</h2>
          <p className="mt-2 text-xs text-slate-500">
            {t('settings.interfaceHint')}
          </p>
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-300">
            {t('settings.interfaceTodo')}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
