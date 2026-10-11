import { useMemo } from "react";
import type { BuildingInfo, BuildingUpgradeEffect } from "@/lib/api/buildings";
import { useI18n } from "@/lib/i18n";

const NUMBER_LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES", de: "de-DE", it: "it-IT" } as const;

function value(
  number: Intl.NumberFormat,
  amount: number,
  unit: BuildingUpgradeEffect["unit"],
  signed = false,
) {
  const rounded = Math.round(amount * 10) / 10;
  const suffix = unit === "perHour" ? "/h" : unit === "percent" ? " %" : "";
  return `${signed && rounded > 0 ? "+" : ""}${number.format(Object.is(rounded, -0) ? 0 : rounded)}${suffix}`;
}
function color(effect: BuildingUpgradeEffect) {
  return effect.delta === 0
    ? "text-slate-400"
    : effect.beneficial
      ? "text-emerald-300"
      : "text-red-300";
}

export function BuildingUpgradeEffects({
  building,
  detailed = false,
}: {
  building: BuildingInfo;
  detailed?: boolean;
}) {
  const { t, locale } = useI18n();
  const number = useMemo(
    () => new Intl.NumberFormat(NUMBER_LOCALES[locale], { maximumFractionDigits: 1 }),
    [locale],
  );
  const upgrade = building.upgrade;
  if (!upgrade)
    return <p className="text-xs text-slate-400">{t("buildings.effects.maxLevel")}</p>;
  const visible = detailed
    ? upgrade.effects
    : upgrade.effects.filter((effect) => effect.compact);
  return (
    <section
      aria-label={t("buildings.effects.aria", { level: upgrade.nextLevel })}
      className={detailed ? "space-y-3" : "space-y-1 sm:space-y-3"}
    >
      <h2
        className={
          detailed
            ? "text-sm font-semibold text-slate-200"
            : "hidden text-sm font-semibold text-slate-200 sm:block"
        }
      >
        {t("buildings.effects.atLevel", { level: upgrade.nextLevel })}
      </h2>
      {detailed ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-3" scope="col">
                  {t("buildings.effects.effect")}
                </th>
                <th className="px-2 text-right" scope="col">
                  {t("buildings.effects.current")}
                </th>
                <th className="px-2 text-right" scope="col">
                  {t("buildings.effects.level", { level: upgrade.nextLevel })}
                </th>
                <th className="pl-2 text-right" scope="col">
                  {t("buildings.effects.variation")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((effect) => (
                <tr key={effect.key} className="border-t border-slate-800">
                  <th
                    className="py-3 pr-3 font-normal text-slate-300"
                    scope="row"
                  >
                    {effect.label}
                  </th>
                  <td className="px-2 text-right font-mono text-slate-400">
                    {value(number, effect.current, effect.unit)}
                  </td>
                  <td className="px-2 text-right font-mono text-slate-200">
                    {value(number, effect.next, effect.unit)}
                  </td>
                  <td className={`pl-2 text-right font-mono ${color(effect)}`}>
                    {value(number, effect.delta, effect.unit, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-1 text-xs">
          {visible.map((effect) => (
            <li
              key={effect.key}
              className="flex items-start justify-between gap-3"
            >
              <span className="text-slate-400">{effect.label}</span>
              <span
                className={`shrink-0 font-mono font-semibold ${color(effect)}`}
              >
                {value(number, effect.delta, effect.unit, true)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {upgrade.unlocks.length > 0 && (
        <p className="text-xs text-emerald-300">
          {t("buildings.effects.unlocks", { names: upgrade.unlocks.join(", ") })}
        </p>
      )}
      {visible.length === 0 && upgrade.unlocks.length === 0 && (
        <p className="text-xs text-slate-400">
          {t("buildings.effects.seeDescription")}
        </p>
      )}
      {upgrade.energyLimited && [1, 2, 3, 4, 12].includes(building.id) && (
        <p className="text-xs text-amber-300">
          {t("buildings.effects.lowEnergy")}
        </p>
      )}
      {detailed && [1, 2, 3, 4, 12].includes(building.id) && (
        <p className="text-xs text-slate-400">
          {t("buildings.effects.forecast")}
        </p>
      )}
      {detailed &&
        upgrade.effects.some((effect) => effect.key.endsWith("-duration")) && (
          <p className="text-xs text-slate-400">
            {t("buildings.effects.durationNote")}
          </p>
        )}
    </section>
  );
}
