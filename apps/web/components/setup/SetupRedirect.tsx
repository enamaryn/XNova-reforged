"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSetupStatus } from "@/lib/api/setup";

/**
 * Tant que le serveur n'est pas installé, toute page d'authentification renvoie vers le parcours d'installation.
 * Silencieux si l'API est injoignable (la page de connexion affichera l'erreur réseau le moment venu).
 */
export function SetupRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.includes("/setup")) return;
    let cancelled = false;
    getSetupStatus()
      .then((status) => {
        if (!cancelled && status.setupRequired) window.location.replace("/setup");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
