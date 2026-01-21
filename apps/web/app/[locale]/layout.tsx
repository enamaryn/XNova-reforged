import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/config';
import Providers from './providers';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/toaster';
import { OfflineBanner } from '@/components/offline-banner';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Get messages for the locale
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
              <Header />
              <main className="w-full">{children}</main>
              <Footer />
            </div>
          </Providers>
          <Toaster />
          <OfflineBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
