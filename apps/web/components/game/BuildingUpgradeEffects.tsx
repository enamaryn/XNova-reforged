import type { BuildingInfo, BuildingUpgradeEffect } from "@/lib/api/buildings";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
function value(
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
  const upgrade = building.upgrade;
  if (!upgrade)
    return (
      <p className="text-xs text-slate-400">
        Niveau maximum atteint : aucune amélioration supplémentaire.
      </p>
    );
  const visible = detailed
    ? upgrade.effects
    : upgrade.effects.filter((effect) => effect.compact);
  return (
    <section
      aria-label={`Effets du niveau ${upgrade.nextLevel}`}
      className="space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-200">
        Au niveau {upgrade.nextLevel}
      </h2>
      {detailed ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-3" scope="col">
                  Effet
                </th>
                <th className="px-2 text-right" scope="col">
                  Actuel
                </th>
                <th className="px-2 text-right" scope="col">
                  Niveau {upgrade.nextLevel}
                </th>
                <th className="pl-2 text-right" scope="col">
                  Variation
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
                    {value(effect.current, effect.unit)}
                  </td>
                  <td className="px-2 text-right font-mono text-slate-200">
                    {value(effect.next, effect.unit)}
                  </td>
                  <td className={`pl-2 text-right font-mono ${color(effect)}`}>
                    {value(effect.delta, effect.unit, true)}
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
                {value(effect.delta, effect.unit, true)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {upgrade.unlocks.length > 0 && (
        <p className="text-xs text-emerald-300">
          + Prérequis remplis pour : {upgrade.unlocks.join(", ")}.
        </p>
      )}
      {visible.length === 0 && upgrade.unlocks.length === 0 && (
        <p className="text-xs text-slate-400">
          Consultez la description et les coûts de cette amélioration.
        </p>
      )}
      {upgrade.energyLimited && [1, 2, 3, 4, 12].includes(building.id) && (
        <p className="text-xs text-amber-300">
          Énergie insuffisante : la production réelle des mines sera réduite.
        </p>
      )}
      {detailed && [1, 2, 3, 4, 12].includes(building.id) && (
        <p className="text-xs text-slate-400">
          Prévision avec les niveaux actuels de la planète et les
          multiplicateurs du serveur. La production réelle tient compte du
          rendement énergétique.
        </p>
      )}
      {detailed &&
        upgrade.effects.some((effect) => effect.key.endsWith("-duration")) && (
          <p className="text-xs text-slate-400">
            Réduction de durée à coût identique, avant arrondi et minimum d’une
            seconde. Les constructions et recherches déjà lancées conservent
            leur durée.
          </p>
        )}
    </section>
  );
}
