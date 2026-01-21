'use client';

import Link from 'next/link';
import { TECHNOLOGIES, getTechnologyCost } from '@xnova/game-config';
import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { designTokens } from '@/lib/design-tokens';

export function ResearchDetailClient({ techId }: { techId: string }) {
  const shouldReduceMotion = useReducedMotion();
  const fadeInProps: MotionProps = shouldReduceMotion ? {} : designTokens.animations.fadeIn;
  const techIdNum = Number(techId);
  const tech = TECHNOLOGIES[techIdNum];
  const { t } = useI18n();

  if (!tech) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-slate-300">
          Technologie introuvable.
        </div>
        <Link
          href="/research"
          className="text-sm text-blue-300 hover:text-blue-200"
        >
          Retour aux technologies
        </Link>
      </div>
    );
  }

  const baseCost = getTechnologyCost(tech.id, 0);

  return (
    <motion.div {...fadeInProps} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Technologie
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{tech.name}</h1>
          <p className="text-sm text-slate-400">{tech.description}</p>
        </div>
        <Link
          href="/research"
          className="rounded-full border border-slate-800 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-white"
        >
          Retour
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Détails
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Catégorie</span>
              <span className="font-mono text-slate-200">{t(`techCategory.${tech.category}`)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Facteur</span>
              <span className="font-mono text-slate-200">{tech.factor.toFixed(1)}</span>
            </div>
          </div>

          {tech.requirements && (
            <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-sm text-slate-400">
              <p className="mb-2 font-semibold text-slate-200">Prérequis</p>
              <ul className="list-disc list-inside">
                {Object.entries(tech.requirements).map(([key, value]) => (
                  <li key={key}>
                    ID {key} niveau {value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Coût niveau 1
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Métal</span>
              <span className="font-mono text-amber-300">{baseCost.metal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Cristal</span>
              <span className="font-mono text-sky-300">{baseCost.crystal}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
              <span>Deutérium</span>
              <span className="font-mono text-blue-300">{baseCost.deuterium}</span>
            </div>
            {baseCost.energy !== undefined && (
              <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-3">
                <span>Énergie</span>
                <span className="font-mono text-amber-200">{baseCost.energy}</span>
              </div>
            )}
          </div>

          <button
            disabled
            className="mt-6 w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-500"
          >
            Recherche bientôt disponible
          </button>
        </div>
      </div>
    </motion.div>
  );
}
