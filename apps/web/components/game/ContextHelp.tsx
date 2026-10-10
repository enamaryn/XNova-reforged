"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type HelpTopic = "energy" | "buildings" | "research" | "shipyard" | "fleet";

const storageKey = (topic: HelpTopic) => `xnova-help-${topic}`;

function readClosed(topic: HelpTopic): boolean {
  try {
    return window.localStorage.getItem(storageKey(topic)) === "closed";
  } catch {
    return false;
  }
}

/**
 * Explication courte d'une mécanique, repliable et mémorisée par rubrique.
 * Ouverte par défaut tant que le joueur ne l'a pas fermée.
 */
export function ContextHelp({ topic }: { topic: HelpTopic }) {
  const { t } = useI18n();
  // Ouverte au rendu serveur et à l'hydratation ; l'état mémorisé est appliqué ensuite (évite un écart d'hydratation).
  const [open, setOpen] = useState<boolean>(true);

  useEffect(() => {
    setOpen(!readClosed(topic));
  }, [topic]);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(storageKey(topic), next ? "open" : "closed");
    } catch {
      /* stockage indisponible : l'état n'est pas mémorisé */
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`help-open-${topic}`}
        onClick={() => toggle(true)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
      >
        <span aria-hidden="true">?</span> {t("help.open")}
      </button>
    );
  }

  return (
    <aside
      data-testid={`help-${topic}`}
      className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-white">{t(`help.${topic}.title`)}</p>
        <button
          type="button"
          onClick={() => toggle(false)}
          className="shrink-0 text-xs text-blue-300 hover:text-blue-200"
        >
          {t("help.gotIt")}
        </button>
      </div>
      <p className="mt-2 text-slate-400">{t(`help.${topic}.body`)}</p>
    </aside>
  );
}
