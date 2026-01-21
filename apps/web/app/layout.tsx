import type { Metadata, Viewport } from "next";
import { Spline_Sans, Space_Grotesk } from "next/font/google";
import { locales } from "@/i18n/config";

import "./globals.css";

const splineSans = Spline_Sans({
  subsets: ["latin"],
  variable: "--font-spline-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

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
