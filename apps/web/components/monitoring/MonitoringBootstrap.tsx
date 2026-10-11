"use client";

import { useEffect } from "react";
import { installGlobalErrorReporting } from "@/lib/monitoring/client-reporter";
import { loadRuntimeSentry } from "@/lib/monitoring/sentry-loader";

/** Active la remontée locale des erreurs du navigateur et, si l'administrateur l'a choisi, Sentry. */
export function MonitoringBootstrap() {
  useEffect(() => {
    const uninstall = installGlobalErrorReporting();
    void loadRuntimeSentry();
    return uninstall;
  }, []);
  return null;
}
