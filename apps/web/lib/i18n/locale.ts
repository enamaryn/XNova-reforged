import { locales, defaultLocale, localeNames, type Locale } from '@/i18n/config';

export { locales, defaultLocale, localeNames };
export type { Locale };

/** Drapeaux affichés dans les sélecteurs de langue. */
export const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
  it: '🇮🇹',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Remplace (ou insère) le segment de langue d'un chemin : `/fr/overview` → `/de/overview`. */
export function pathWithLocale(pathname: string, next: Locale): string {
  const segments = pathname.split('/');
  const index = segments.findIndex((segment) => isLocale(segment));
  if (index !== -1) {
    segments[index] = next;
  } else {
    segments.splice(1, 0, next);
  }
  return segments.join('/');
}

/** Mémorise le choix de langue (lu par le middleware pour les visites sans préfixe). */
export function persistLocaleCookie(next: Locale) {
  document.cookie = `NEXT_LOCALE=${next}; max-age=${60 * 60 * 24 * 365}; path=/`;
}
