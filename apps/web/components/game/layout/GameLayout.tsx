'use client';

import { useState } from 'react';
import { GameHeader } from './GameHeader';
import { GameSidebar } from './GameSidebar';

interface GameLayoutProps {
  children: React.ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Fond étoilé */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 25%),
            radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 25%),
            radial-gradient(circle at 40% 80%, rgba(6, 182, 212, 0.05) 0%, transparent 25%),
            radial-gradient(1px 1px at 10% 10%, white 1px, transparent 1px),
            radial-gradient(1px 1px at 20% 20%, rgba(255,255,255,0.8) 1px, transparent 1px),
            radial-gradient(1px 1px at 30% 30%, rgba(255,255,255,0.6) 1px, transparent 1px),
            radial-gradient(1px 1px at 40% 40%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(1px 1px at 50% 50%, white 1px, transparent 1px),
            radial-gradient(1px 1px at 60% 60%, rgba(255,255,255,0.7) 1px, transparent 1px),
            radial-gradient(1px 1px at 70% 70%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(1px 1px at 80% 80%, rgba(255,255,255,0.3) 1px, transparent 1px),
            radial-gradient(1px 1px at 90% 90%, rgba(255,255,255,0.9) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 250px 250px, 200px 200px, 300px 300px, 350px 350px, 280px 280px, 220px 220px, 180px 180px, 320px 320px, 270px 270px',
        }}
      />

      {/* Header */}
      <GameHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Sidebar */}
      <GameSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Contenu principal */}
      <main className="relative z-10 pt-14 lg:pl-64">
        {/* Zone de ressources mobile */}
        <div className="md:hidden h-10" />

        {/* Contenu */}
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
