'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { locales, localeNames, pathWithLocale, persistLocaleCookie, type Locale } from '@/lib/i18n/locale';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  const handleLocaleChange = (newLocale: Locale) => {
    persistLocaleCookie(newLocale);
    router.push(pathWithLocale(pathname, newLocale));
    router.refresh();
  };

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800"
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        <span className="uppercase">{currentLocale}</span>
      </button>

      <div className="absolute right-0 top-full mt-2 hidden w-32 rounded-lg border border-slate-700 bg-slate-800 shadow-xl group-hover:block">
        <div className="p-1">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                locale === currentLocale
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {localeNames[locale]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
