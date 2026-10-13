"use client";

import { useQuery } from "@tanstack/react-query";
import { worldEventsApi, type WorldEventView } from "@/lib/api/world-events";
import { useI18n } from "@/lib/i18n";

/** Nom affiché : le nom saisi pour un événement personnalisé, sinon le nom traduit du modèle. */
export function worldEventName(event: WorldEventView, t: (key: string) => string): string {
  if (event.name) return event.name;
  const key = `worldEvents.names.${event.templateId}`;
  const translated = t(key);
  return translated === key ? (event.templateId ?? "") : translated;
}

/** Bannière des événements du monde en cours : nom, fin et effets. N'affiche rien s'il n'y en a pas. */
export function WorldEventsBanner() {
  const { t, locale } = useI18n();
  const { data } = useQuery({
    queryKey: ["world-events", "active"],
    queryFn: worldEventsApi.active,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  if (!data || data.events.length === 0) return null;

  const percent = (value: number) => Math.round(value * 1000) / 10;
  return (
    <section aria-label={t("worldEvents.banner.title")} className="mb-4 space-y-2" data-testid="world-events-banner">
      {data.events.map((event) => (
        <div
          key={event.id}
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          data-testid="world-event"
        >
          <p className="font-semibold">
            ✨ {worldEventName(event, t)}{" "}
            <span className="font-normal text-amber-200/80">
              ·{" "}
              {t("worldEvents.banner.until", {
                date: new Date(event.endsAt).toLocaleDateString(locale, { day: "numeric", month: "long" }),
              })}
            </span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-200">
            {event.effects.productionBonus > 0 ? (
              <span>{t("worldEvents.banner.production", { percent: percent(event.effects.productionBonus) })}</span>
            ) : null}
            {event.effects.marketTaxReduction > 0 ? (
              <span>{t("worldEvents.banner.marketTax", { percent: percent(event.effects.marketTaxReduction) })}</span>
            ) : null}
          </p>
        </div>
      ))}
    </section>
  );
}
