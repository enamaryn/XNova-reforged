import type { Metadata, Viewport } from "next";
import { locales } from "@/i18n/config";

import "./globals.css";

export const metadata: Metadata = {
  title: "XNova Reforged",
  description: "MMOSTR nouvelle génération inspiré de XNova.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
