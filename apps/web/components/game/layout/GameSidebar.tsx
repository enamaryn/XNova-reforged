'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/stores/auth-store';
import { hasAdminAccess } from '@/lib/roles';

interface GameSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  category?: string;
}

const navItems: NavItem[] = [
  // Principal
  { href: '/overview', label: 'nav.overview', icon: '🏠', category: 'principal' },

  // Construction
  { href: '/buildings', label: 'nav.buildings', icon: '🏗️', category: 'construction' },
  { href: '/research', label: 'nav.research', icon: '🔬', category: 'construction' },
  { href: '/shipyard', label: 'nav.shipyard', icon: '🚀', category: 'construction' },
  { href: '/defense', label: 'nav.defense', icon: '🛡️', category: 'construction' },

  // Flotte
  { href: '/fleet', label: 'nav.fleet', icon: '🛸', category: 'flotte' },
  { href: '/movement', label: 'nav.movement', icon: '🛰️', category: 'flotte' },
  { href: '/galaxy', label: 'nav.galaxy', icon: '🌌', category: 'flotte' },

  // Social
  { href: '/alliance', label: 'nav.alliance', icon: '🤝', category: 'social' },
  { href: '/messages', label: 'nav.messages', icon: '✉️', category: 'social' },

  // Autre
  { href: '/statistics', label: 'nav.statistics', icon: '📊', category: 'autre' },
  { href: '/reports', label: 'nav.reports', icon: '⚔️', category: 'autre' },
  { href: '/options', label: 'nav.options', icon: '⚙️', category: 'autre' },
  { href: '/admin', label: 'nav.admin', icon: '🛠️', category: 'autre' },
];

export function GameSidebar({ isOpen, onClose }: GameSidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isAdmin = hasAdminAccess(user?.role);

  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      principal: t('sidebar.principal'),
      construction: t('sidebar.construction'),
      flotte: t('sidebar.fleet'),
      social: t('sidebar.social'),
      autre: t('sidebar.other'),
    }),
    [t],
  );

  const groupedItems = useMemo(() => {
    return navItems
      .filter((item) => (item.href === '/admin' ? isAdmin : true))
      .reduce((acc, item) => {
        const cat = item.category || 'autre';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {} as Record<string, NavItem[]>);
  }, [isAdmin]);

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] md:bottom-0 flex w-64 flex-col bg-slate-950/95 border-r border-slate-800/60 z-40 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <nav aria-label="Menu du jeu" className="grid min-h-0 flex-1 px-3 py-2"
          style={{ gridTemplateRows: `repeat(${Object.values(groupedItems).reduce((count, items) => count + items.length + 1, 0)}, minmax(0, 1fr))` }}>
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="contents">
              <h3 className="flex min-h-0 items-center px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {categoryLabels[category]}
              </h3>
              <ul className="contents">
                {items.map((item) => {
                  const isActive = pathname === item.href;
                  const showAdminBadge = item.href === '/admin';
                  return (
                    <li key={item.href} className="min-h-0">
                      <Link
                        href={item.href}
                        prefetch={item.href !== '/admin'}
                        onClick={onClose}
                        className={`flex h-full min-h-0 items-center gap-3 px-3 rounded-lg text-[clamp(10px,1.9vh,14px)] leading-tight transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-500/15 text-blue-300 font-medium border border-blue-500/40'
                            : 'text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent'
                        }`}
                      >
                        <span className="w-6 shrink-0 text-center text-[1.2em]">{item.icon}</span>
                        <span>{t(item.label)}</span>
                        {(showAdminBadge || isActive) && (
                          <div className="ml-auto flex items-center gap-2">
                            {showAdminBadge && (
                              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                                Admin
                              </span>
                            )}
                            {isActive && (
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                            )}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Info bas de sidebar */}
        <div className="shrink-0 px-3 py-2 border-t border-slate-800/60 bg-slate-950/90">
          <div className="text-center">
            <p className="text-[10px] text-slate-500">XNova Reforged · v0.1.0 Alpha</p>
          </div>
        </div>
      </aside>
    </>
  );
}
