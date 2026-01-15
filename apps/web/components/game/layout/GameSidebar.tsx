'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  { href: '/overview', label: 'Vue d\'ensemble', icon: '🏠', category: 'principal' },

  // Construction
  { href: '/buildings', label: 'Bâtiments', icon: '🏗️', category: 'construction' },
  { href: '/research', label: 'Recherche', icon: '🔬', category: 'construction' },
  { href: '/shipyard', label: 'Chantier spatial', icon: '🚀', category: 'construction' },
  { href: '/defense', label: 'Défense', icon: '🛡️', category: 'construction' },

  // Flotte
  { href: '/fleet', label: 'Flotte', icon: '🛸', category: 'flotte' },
  { href: '/galaxy', label: 'Galaxie', icon: '🌌', category: 'flotte' },

  // Social
  { href: '/alliance', label: 'Alliance', icon: '🤝', category: 'social' },
  { href: '/messages', label: 'Messages', icon: '✉️', category: 'social' },

  // Autre
  { href: '/statistics', label: 'Statistiques', icon: '📊', category: 'autre' },
  { href: '/options', label: 'Options', icon: '⚙️', category: 'autre' },
];

const categoryLabels: Record<string, string> = {
  principal: 'Principal',
  construction: 'Construction',
  flotte: 'Flotte & Exploration',
  social: 'Social',
  autre: 'Autre',
};

export function GameSidebar({ isOpen, onClose }: GameSidebarProps) {
  const pathname = usePathname();

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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-700/50 z-40 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Contenu scrollable */}
        <nav className="h-full overflow-y-auto py-4 px-3">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h3 className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-600/20 text-blue-400 font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="text-lg w-6 text-center">{item.icon}</span>
                        <span>{item.label}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50 bg-slate-900">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">XNova Reforged</p>
            <p className="text-xs text-slate-400">v0.1.0 Alpha</p>
          </div>
        </div>
      </aside>
    </>
  );
}
