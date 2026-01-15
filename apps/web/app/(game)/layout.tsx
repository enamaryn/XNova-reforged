import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Forcer le rendu dynamique pour toutes les pages du jeu
export const dynamic = 'force-dynamic';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg">
        <ProtectedRoute>{children}</ProtectedRoute>
      </div>
    </section>
  );
}
