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
          <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200">
            <Header />
            <main className="mx-auto w-full max-w-6xl px-6 py-10">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
