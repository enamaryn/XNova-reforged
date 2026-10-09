"use client";

import { usePathname } from "next/navigation";
import { locales } from "@/i18n/config";

const gamePages = new Set([
  "overview",
  "buildings",
  "research",
  "fleet",
  "galaxy",
  "shipyard",
  "defense",
  "alliance",
  "messages",
  "reports",
  "statistics",
  "settings",
  "options",
  "movement",
  "admin",
]);

export function LocaleShell({
  children,
  header,
  footer,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const segments = usePathname().split("/").filter(Boolean);
  const page = locales.includes(segments[0] as (typeof locales)[number])
    ? segments[1]
    : segments[0];
  // La page d'accueil possède son propre cadre immersif, navigation et pied de page.
  if (!page) return <>{children}</>;
  // Game pages already provide their own fixed header, main and navigation.
  if (gamePages.has(page)) return <>{children}</>;
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      {header}
      <main className="w-full">{children}</main>
      {footer}
    </div>
  );
}
