"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const tokens = useAuthStore((state) => state.tokens);
  const setStatus = useAuthStore((state) => state.setStatus);
  const [hydrated, setHydrated] = useState(
    useAuthStore.persist.hasHydrated()
  );

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!tokens?.accessToken) {
      setStatus("unauthenticated");
      router.replace("/login");
    }
  }, [hydrated, tokens, router, setStatus]);

  if (!hydrated || !tokens?.accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
        Verification de la session en cours...
      </div>
    );
  }

  return <>{children}</>;
}
