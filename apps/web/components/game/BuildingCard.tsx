"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import type { BuildingInfo } from "@/lib/api/buildings";
import { BuildingUpgradeEffects } from "./BuildingUpgradeEffects";

interface BuildingCardProps {
  building: BuildingInfo;
  onBuild: (buildingId: number) => Promise<void>;
  isBuilding: boolean;
}

// Icônes par catégorie
const categoryIcons: Record<string, string> = {
  resource: "⛏️",
  facility: "🏭",
  station: "🏢",
  defense: "🛡️",
  moon: "🌙",
};

// Couleurs par catégorie
const categoryColors: Record<string, string> = {
  resource: "border-amber-500/40 hover:border-amber-400",
  facility: "border-blue-500/40 hover:border-blue-400",
  station: "border-sky-500/40 hover:border-sky-400",
  defense: "border-red-500/40 hover:border-red-400",
  moon: "border-slate-400/40 hover:border-slate-300",
};

// Formater le temps (secondes -> format lisible)
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Formater les nombres
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const BuildingCard = memo(function BuildingCard({
  building,
  onBuild,
  isBuilding,
}: BuildingCardProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    if (!building.canBuild || loading) return;
    setLoading(true);
    try {
      await onBuild(building.id);
    } finally {
      setLoading(false);
    }
  };

  const icon = categoryIcons[building.category] || "🏗️";
  const borderColor = categoryColors[building.category] || "border-gray-500/50";
  const categoryLabel = getCategoryLabel(building.category, t);

  return (
    <motion.article
      aria-label={building.name}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border ${borderColor} bg-slate-900/60 p-2.5 sm:p-4 backdrop-blur-sm transition-all duration-200 shadow-[0_0_24px_rgba(15,23,42,0.6)]`}
    >
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white sm:text-base">
              {building.name}
            </h3>
            <span className="hidden text-xs text-slate-500 sm:inline">
              {categoryLabel}
            </span>
          </div>
        </div>
        <div className="rounded-full border border-slate-700/80 bg-slate-900/70 shrink-0 px-2 py-1 sm:px-3">
          <span className="text-xs font-mono text-slate-200">
            Niv. {building.currentLevel}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 hidden text-sm text-slate-400 sm:line-clamp-2">
        {building.description}
      </p>

      <div className="mb-1 sm:mb-3 sm:rounded-xl sm:bg-slate-950/40 sm:p-3">
        <BuildingUpgradeEffects building={building} />
      </div>

      {/* Mobile: costs and duration share one compact row. */}
      <div className="mb-1 flex items-center justify-between gap-2 text-xs sm:mb-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
          <span
            aria-label={t("buildings.costMetalAria", { value: building.cost.metal })}
            className={building.canAfford ? "text-amber-300" : "text-red-400"}
          >
            ⚙️ {formatNumber(building.cost.metal)}
          </span>
          <span
            aria-label={t("buildings.costCrystalAria", { value: building.cost.crystal })}
            className={building.canAfford ? "text-sky-300" : "text-red-400"}
          >
            💎 {formatNumber(building.cost.crystal)}
          </span>
          {building.cost.deuterium > 0 && (
            <span
              aria-label={t("buildings.costDeuteriumAria", { value: building.cost.deuterium })}
              className={building.canAfford ? "text-blue-300" : "text-red-400"}
            >
              🧪 {formatNumber(building.cost.deuterium)}
            </span>
          )}
        </div>
        <span
          aria-label={t("buildings.durationAria")}
          className="shrink-0 font-mono text-slate-300"
        >
          ⏱ {formatTime(building.buildTime)}
        </span>
      </div>

      {/* Prérequis manquants */}
      {building.missingRequirements.length > 0 && (
        <div className="mb-2 rounded-xl bg-red-500/10 p-2 text-xs text-red-300">
          <div className="hidden font-semibold mb-1 sm:block">
            {t("buildings.missingTitle")}
          </div>
          <ul className="line-clamp-1 sm:line-clamp-none sm:list-disc sm:list-inside">
            {building.missingRequirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {building.isMaxLevel && (
        <div className="mb-3 rounded-xl bg-slate-800/70 p-2 text-xs text-slate-300">
          {t("buildings.maxReached")}
        </div>
      )}

      {/* En construction */}
      {building.inQueue && (
        <div className="mb-2 hidden rounded-xl bg-blue-500/10 p-2 text-center text-sm sm:block text-blue-200">
          {t("buildings.underConstruction")}
        </div>
      )}

      {/* Bouton construire */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleBuild}
          disabled={!building.canBuild || loading || isBuilding}
          className={`min-h-11 flex-1 rounded-xl py-2 px-2 text-xs sm:px-4 sm:text-sm font-semibold transition-all duration-200 ${
            building.canBuild && !loading && !isBuilding
              ? "bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 cursor-pointer"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          {loading
            ? t("buildings.btnBuilding")
            : building.inQueue
              ? t("buildings.btnQueued")
              : building.isMaxLevel
                ? t("buildings.btnMax")
                : building.capacityFull
                  ? t("buildings.btnCapacity", { count: building.buildingCapacity ?? "" })
                  : !building.canAfford
                    ? t("buildings.btnFunds")
                    : building.missingRequirements.length > 0
                      ? t("buildings.btnLocked")
                      : t("buildings.btnBuild", { level: building.currentLevel + 1 })}
        </button>
        <Link
          href={`/buildings/${building.id}`}
          className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-center text-xs text-slate-300 transition hover:border-slate-500 hover:text-white sm:w-auto"
        >
          {t("common.details")}
        </Link>
      </div>
    </motion.article>
  );
});

BuildingCard.displayName = "BuildingCard";

function getCategoryLabel(
  category: string,
  t: (key: string) => string,
): string {
  const known = ["resource", "facility", "station", "defense", "moon"];
  return known.includes(category) ? t(`buildings.category.${category}`) : category;
}
