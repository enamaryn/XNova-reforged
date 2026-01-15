'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ResourceBar } from './ResourceBar';
import { PlanetSelector } from './PlanetSelector';

interface GameHeaderProps {
  onMenuToggle: () => void;
}

export function GameHeader({ onMenuToggle }: GameHeaderProps) {
  const { user, reset } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    reset();
    window.location.href = '/login';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-4">
        {/* Gauche: Menu burger + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/overview" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">X</span>
            </div>
            <span className="hidden sm:block text-lg font-bold text-white tracking-tight">
              XNova
            </span>
          </Link>
        </div>

        {/* Centre: Ressources */}
        <div className="hidden md:flex items-center">
          <ResourceBar />
        </div>

        {/* Droite: Planète + Utilisateur */}
        <div className="flex items-center gap-3">
          <PlanetSelector />

          {/* Menu utilisateur */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden sm:block">{user?.username || 'Joueur'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl z-20">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <p className="text-sm font-medium text-white">{user?.username}</p>
                    <p className="text-xs text-slate-400">Rang #{user?.rank || '-'}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Paramètres
                  </Link>
                  <Link
                    href="/messages"
                    className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Messages
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ressources sur mobile (sous le header) */}
      <div className="md:hidden border-t border-slate-700/50 bg-slate-900/95 px-4 py-2">
        <ResourceBar compact />
      </div>
    </header>
  );
}
