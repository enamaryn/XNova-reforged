'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { GameHeader } from './GameHeader';
import { GameSidebar } from './GameSidebar';
import { PageTransition } from '@/components/page-transition';

const CombatNotifications = dynamic(
  () => import('../CombatNotifications').then((mod) => mod.CombatNotifications),
  {
    ssr: false,
    loading: () => null,
  },
);

interface GameLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout principal du jeu avec fond spatial anime.
 *
 * Features:
 * - Background en gradients radiaux et pattern d'etoiles.
 * - Sidebar responsive (menu mobile).
 * - Header avec selection de planete.
 * - Chargement differe des notifications de combat.
 *
 * @param children - Pages du jeu (overview, buildings, etc.).
 */
export function GameLayout({ children }: GameLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 overflow-x-hidden">
      {/* Fond spatial */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.18) 0%, transparent 40%),
            radial-gradient(circle at 85% 10%, rgba(14, 165, 233, 0.12) 0%, transparent 35%),
            radial-gradient(circle at 60% 85%, rgba(2, 132, 199, 0.12) 0%, transparent 40%),
            linear-gradient(180deg, rgba(2, 6, 23, 0.96) 0%, rgba(2, 6, 23, 1) 100%),
            radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.9) 1px, transparent 1px),
            radial-gradient(1px 1px at 28% 32%, rgba(255,255,255,0.6) 1px, transparent 1px),
            radial-gradient(1px 1px at 46% 22%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(1px 1px at 62% 40%, rgba(255,255,255,0.7) 1px, transparent 1px),
            radial-gradient(1px 1px at 78% 28%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(1px 1px at 88% 60%, rgba(255,255,255,0.8) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 260px 260px, 320px 320px, 240px 240px, 360px 360px, 300px 300px, 280px 280px',
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:120px_120px]" />
      </div>

      {/* Header */}
      <GameHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Sidebar */}
      <GameSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Contenu principal */}
      <main className="relative z-10 w-full min-w-0 pt-14 lg:pl-64">
        {/* Zone de ressources mobile */}
        <div className="md:hidden h-10" />

        {/* Contenu */}
        <div className="min-w-0 p-4 pb-20 md:p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      <CombatNotifications />

      {/* Navigation mobile rapide */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          <a href="/overview" className="flex flex-col items-center gap-1 text-slate-300">
            <span className="text-lg">🏠</span>
            Vue
          </a>
          <a href="/buildings" className="flex flex-col items-center gap-1 text-slate-300">
            <span className="text-lg">🏗️</span>
            Bâtiments
          </a>
          <a href="/research" className="flex flex-col items-center gap-1 text-slate-300">
            <span className="text-lg">🔬</span>
            Recherche
          </a>
          <a href="/fleet" className="flex flex-col items-center gap-1 text-slate-300">
            <span className="text-lg">🛸</span>
            Flotte
          </a>
          <a href="/galaxy" className="flex flex-col items-center gap-1 text-slate-300">
            <span className="text-lg">🌌</span>
            Galaxie
          </a>
        </div>
      </div>
    </div>
  );
}
