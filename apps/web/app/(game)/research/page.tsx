'use client';

import Link from 'next/link';
import { TECHNOLOGIES } from '@xnova/game-config';
import { useI18n } from '@/lib/i18n';

export default function ResearchPage() {
  const technologies = Object.values(TECHNOLOGIES);
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Laboratoire</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Technologies</h1>
        <p className="text-sm text-slate-400">
          Déverrouillez des avantages stratégiques pour vos flottes et infrastructures.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {technologies.map((tech) => (
          <Link
            key={tech.id}
            href={`/research/${tech.id}`}
            className="group rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition hover:border-blue-500/50 hover:bg-slate-900/70"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  {t(`techCategory.${tech.category}`)}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">{tech.name}</h2>
                <p className="mt-2 text-sm text-slate-400 line-clamp-2">
                  {tech.description}
                </p>
              </div>
              <div className="text-3xl">🧬</div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Facteur {tech.factor.toFixed(1)}</span>
              <span>Voir la fiche</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
