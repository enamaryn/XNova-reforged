'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

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
  { href: '/options', label: 'nav.options', icon: '⚙️', category: 'autre' },
];

export function GameSidebar({ isOpen, onClose }: GameSidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  const categoryLabels: Record<string, string> = {
    principal: t('sidebar.principal'),
    construction: t('sidebar.construction'),
    flotte: t('sidebar.fleet'),
    social: t('sidebar.social'),
    autre: t('sidebar.other'),
  };

  // Grouper par catégorie
  const groupedItems = navItems.reduce((acc, item) => {
    const cat = item.category || 'autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

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
        className={`fixed top-14 left-0 bottom-0 w-64 bg-slate-950/95 border-r border-slate-800/60 z-40 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Contenu scrollable */}
        <nav className="h-full overflow-y-auto py-4 px-3">
          <div className="mb-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              {t('sidebar.quickAccess')}
            </p>
            <div className="mt-3 grid gap-2">
              <Link
                href="/overview"
                onClick={onClose}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                <span>{t('sidebar.planetView')}</span>
                <span className="text-lg">🪐</span>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/buildings"
                  onClick={onClose}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                  🏗️ {t('nav.buildings')}
                </Link>
                <Link
                  href="/research"
                  onClick={onClose}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                  🔬 {t('nav.research')}
                </Link>
              </div>
            </div>
          </div>
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h3 className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                {categoryLabels[category]}
              </h3>
              <ul className="space-y-1">
                {items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-500/15 text-blue-300 font-medium border border-blue-500/40'
                            : 'text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent'
                        }`}
                      >
                        <span className="text-lg w-6 text-center">{item.icon}</span>
                        <span>{t(item.label)}</span>
                        {isActive && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/60 bg-slate-950/90">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">XNova Reforged</p>
            <p className="text-xs text-slate-400">v0.1.0 Alpha</p>
          </div>
        </div>
      </aside>
    </>
  );
}
