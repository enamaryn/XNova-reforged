"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getOnboarding } from "@/lib/api/progression";
import { useI18n } from "@/lib/i18n";

const DISMISS_KEY = "xnova-onboarding-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Guide des premiers pas : objectifs calculés par le serveur d'après l'état réel du joueur
 * (bâtiments, recherches, vaisseaux, missions), avec lien direct vers l'action à faire.
 */
export function OnboardingGuide() {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window === "undefined" ? false : readDismissed(),
  );

  const { data } = useQuery({
    queryKey: ["onboarding"],
    queryFn: getOnboarding,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  if (!data || dismissed) return null;

  const current = data.steps.find((step) => step.status === "current");
  const percent = Math.round((data.completed / data.total) * 100);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* stockage indisponible : le guide revient à la prochaine visite */
    }
  };

  return (
    <section
      data-testid="onboarding-guide"
      aria-labelledby="onboarding-title"
      className="rounded-3xl border border-blue-500/30 bg-blue-500/5 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-blue-300/80">
            {t("onboarding.title")}
          </p>
          <h2 id="onboarding-title" className="mt-1 text-lg font-semibold text-white">
            {data.finished ? t("onboarding.finishedTitle") : t("onboarding.subtitle")}
          </h2>
        </div>
        <p className="text-xs text-slate-300" data-testid="onboarding-progress">
          {t("onboarding.progress", { done: data.completed, total: data.total })}
        </p>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={data.total}
        aria-valuenow={data.completed}
      >
        <div
          className="h-full rounded-full bg-blue-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {data.finished ? (
        <p className="mt-4 text-sm text-slate-300">{t("onboarding.finishedBody")}</p>
      ) : (
        current && (
          <div
            className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4"
            data-testid="onboarding-current"
            data-step={current.id}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              {t("onboarding.next")}
            </p>
            <p className="mt-1 text-base font-medium text-white">
              {t(`onboarding.steps.${current.id}.title`)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {t(`onboarding.steps.${current.id}.hint`)}
            </p>
            <Link
              href={`/${locale}/${current.route}`}
              className="mt-3 inline-flex rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              {t("onboarding.go")}
            </Link>
          </div>
        )
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="text-blue-300 hover:text-blue-200"
        >
          {expanded ? t("onboarding.hideAll") : t("onboarding.showAll")}
        </button>
        {data.finished && (
          <button
            type="button"
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-200"
          >
            {t("onboarding.dismiss")}
          </button>
        )}
      </div>

      {expanded && (
        <ol className="mt-3 space-y-2" data-testid="onboarding-steps">
          {data.steps.map((step) => (
            <li
              key={step.id}
              data-step={step.id}
              data-status={step.status}
              className="flex items-start gap-3 text-sm"
            >
              <span
                aria-label={t(`onboarding.status.${step.status}`)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  step.status === "done"
                    ? "border-emerald-400 bg-emerald-400/20 text-emerald-300"
                    : step.status === "current"
                      ? "border-blue-400 text-blue-300"
                      : "border-slate-700 text-slate-600"
                }`}
              >
                {step.status === "done" ? "✓" : ""}
              </span>
              <span
                className={
                  step.status === "done"
                    ? "text-slate-500 line-through"
                    : step.status === "current"
                      ? "text-white"
                      : "text-slate-400"
                }
              >
                {t(`onboarding.steps.${step.id}.title`)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
