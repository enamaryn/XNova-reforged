'use client';

import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { designTokens } from '@/lib/design-tokens';

export default function DefensePage() {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Infrastructure</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Defense</h1>
          <p className="text-sm text-slate-400">
            Renforcez vos planetes avec des structures defensives.
          </p>
        </div>
        <div className="rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-xs text-slate-400">
          Bientot disponible
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">Module en preparation</h2>
          <p className="mt-2 text-sm text-slate-400">
            Les defenses seront accessibles ici des que l'API et la file de
            construction seront finalisees.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-sm font-semibold text-white">A venir</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-400">
            <li>• Catalogue des defenses (lance-missiles, lasers, boucliers)</li>
            <li>• File de construction et couts detailles</li>
            <li>• Logs de combat et reparations automatiques</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
