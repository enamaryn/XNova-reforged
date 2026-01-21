'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ResourceBar } from './ResourceBar';
import { PlanetSelector } from './PlanetSelector';
import { useI18n } from '@/lib/i18n';
import { hasAdminAccess } from '@/lib/roles';

interface GameHeaderProps {
  onMenuToggle: () => void;
}

export function GameHeader({ onMenuToggle }: GameHeaderProps) {
  const { user, reset } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const langMenuId = 'game-lang-menu';
  const userMenuId = 'game-user-menu';

  const handleLogout = () => {
    reset();
    window.location.href = '/login';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-full min-w-0 items-center justify-between gap-2 px-4">
        {/* Gauche: Menu burger + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden rounded-full border border-slate-800 p-2 text-slate-300 transition-colors hover:text-white"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/overview" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-blue-700">
              <span className="text-white font-semibold text-sm">X</span>
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-cyan-200/80 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            </div>
            <span className="hidden sm:block text-lg font-bold text-white tracking-tight">
              XNova
            </span>
          </Link>
        </div>

        {/* Centre: Ressources + accès rapide */}
        <div className="hidden md:flex items-center gap-6">
          <nav
            className="flex items-center gap-2 text-xs text-slate-300"
            aria-label={t('nav.label')}
          >
            {[
              { href: '/overview', label: t('nav.overview') },
              { href: '/buildings', label: t('nav.buildings') },
              { href: '/research', label: t('nav.research') },
              { href: '/galaxy', label: t('nav.galaxy') },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-slate-800 px-3 py-1 transition-colors hover:border-slate-600 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ResourceBar />
        </div>

        {/* Droite: Planète + Utilisateur */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <PlanetSelector />

          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-2 rounded-full border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
              aria-label={t('common.language')}
              aria-haspopup="menu"
              aria-expanded={showLangMenu}
              aria-controls={langMenuId}
            >
              <span className="text-base">
                {locale === 'fr' ? '🇫🇷' : locale === 'en' ? '🇬🇧' : '🇪🇸'}
              </span>
              <span className="hidden sm:block uppercase tracking-[0.2em]">{locale}</span>
            </button>

            {showLangMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowLangMenu(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-2xl border border-slate-800 bg-slate-950/95 py-2 shadow-xl">
                  <div
                    id={langMenuId}
                    role="menu"
                    aria-label={t('nav.languageMenu')}
                  >
                    {[
                      { code: 'fr', label: 'Français', flag: '🇫🇷' },
                      { code: 'en', label: 'English', flag: '🇬🇧' },
                      { code: 'es', label: 'Español', flag: '🇪🇸' },
                    ].map((item) => (
                      <button
                        key={item.code}
                        onClick={() => {
                          setLocale(item.code as typeof locale);
                          setShowLangMenu(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          locale === item.code
                            ? 'text-blue-300 bg-blue-500/10'
                            : 'text-slate-300 hover:bg-slate-900'
                        }`}
                        role="menuitemradio"
                        aria-checked={locale === item.code}
                      >
                        <span>{item.flag}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Menu utilisateur */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-full border border-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              aria-controls={userMenuId}
              aria-label={t('nav.userMenu')}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-400 flex items-center justify-center">
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
                  <div
                    id={userMenuId}
                    role="menu"
                    aria-label={t('nav.userMenu')}
                  >
                    <div className="px-3 py-2 border-b border-slate-700">
                      <p className="text-sm font-medium text-white">{user?.username}</p>
                      <p className="text-xs text-slate-400">Rang #{user?.rank || '-'}</p>
                    </div>
                    <Link
                      href="/settings"
                      className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                      role="menuitem"
                    >
                      Paramètres
                    </Link>
                    {hasAdminAccess(user?.role) && (
                      <Link
                        href="/admin"
                        prefetch={false}
                        className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                        role="menuitem"
                      >
                        Administration
                      </Link>
                    )}
                    <Link
                      href="/messages"
                      className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                      role="menuitem"
                    >
                      Messages
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                      role="menuitem"
                    >
                      Déconnexion
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ressources sur mobile (sous le header) */}
      <div className="md:hidden border-t border-slate-800/60 bg-slate-950/90 px-4 py-2">
        <ResourceBar compact />
      </div>
    </header>
  );
}
