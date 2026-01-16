'use client';

import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useI18n } from '@/lib/i18n';
import { hasAdminAccess } from '@/lib/roles';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const isAdmin = hasAdminAccess(user?.role);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                {t('admin.kicker')}
              </p>
              <h1 className="text-lg font-semibold text-white">{t('admin.title')}</h1>
            </div>
            <Link
              href="/overview"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500"
            >
              {t('admin.backToGame')}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {isAdmin ? (
            children
          ) : (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
              {t('admin.noAccess')}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
