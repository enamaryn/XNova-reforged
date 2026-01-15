import type { Metadata } from "next";
import { Spline_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";
import Providers from "@/app/providers";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${splineSans.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Providers>
          <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
            <Header />
            <main className="w-full">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
