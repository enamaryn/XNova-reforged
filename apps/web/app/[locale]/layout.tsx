import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/config";
import Providers from "./providers";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/toaster";
import { LocaleShell } from "@/components/layout/LocaleShell";
import { OfflineBanner } from "@/components/offline-banner";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!(locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // Get messages for the locale
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <LocaleShell header={<Header />} footer={<Footer />}>
              {children}
            </LocaleShell>
          </Providers>
          <Toaster />
          <OfflineBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
