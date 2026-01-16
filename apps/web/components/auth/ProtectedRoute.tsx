"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePlanetStore } from "@/lib/stores/planet-store";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const tokens = useAuthStore((state) => state.tokens);
  const setStatus = useAuthStore((state) => state.setStatus);
  const setUser = useAuthStore((state) => state.setUser);
  const selectedPlanetId = usePlanetStore((state) => state.selectedPlanetId);
  const setSelectedPlanetId = usePlanetStore((state) => state.setSelectedPlanetId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }

    const unsubscribe = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });

    if (!unsubscribe) {
      setHydrated(true);
      return;
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!tokens?.accessToken) {
      setStatus("unauthenticated");
      router.replace("/login");
    }
  }, [hydrated, tokens, router, setStatus]);

  useEffect(() => {
    if (!hydrated || !tokens?.accessToken) return;

    let active = true;

    const loadUser = async () => {
      try {
        const me = await apiClient.get<{
          id: string;
          username: string;
          email: string;
          points: number;
          rank: number;
          role?: string;
          createdAt: string;
          planets?: Array<{
            id: string;
            name: string;
            galaxy: number;
            system: number;
            position: number;
          }>;
        }>("/auth/me");

        if (!active) return;
        setUser(me);
        const hasPlanet = me.planets?.some((planet) => planet.id === selectedPlanetId);
        if (!hasPlanet && me.planets?.length) {
          setSelectedPlanetId(me.planets[0].id);
        }
      } catch (error) {
        if (!active) return;
        setStatus("unauthenticated");
      }
    };

    loadUser();

    return () => {
      active = false;
    };
  }, [hydrated, tokens, setUser, selectedPlanetId, setSelectedPlanetId, setStatus]);

  if (!hydrated || !tokens?.accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
        Verification de la session en cours...
      </div>
    );
  }

  return <>{children}</>;
}
