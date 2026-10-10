'use client';

import { useI18n } from '@/lib/i18n';
import { localeFlags, localeNames, locales } from '@/lib/i18n/locale';

/** Choix de la langue de l'interface (les cinq langues proposées par le serveur). */
export function LanguageSettings() {
  const { locale, setLocale, t } = useI18n();

  return (
    <fieldset className="space-y-2" data-testid="language-settings">
      <legend className="text-sm text-slate-300">{t('common.language')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {locales.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={active}
              data-locale={code}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? 'border-blue-500/60 bg-blue-500/10 text-blue-200'
                  : 'border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              <span aria-hidden="true">{localeFlags[code]}</span>
              <span>{localeNames[code]}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
