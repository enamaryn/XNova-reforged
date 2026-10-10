"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import fr from "@/i18n/game/fr.json";
import en from "@/i18n/game/en.json";
import es from "@/i18n/game/es.json";
import de from "@/i18n/game/de.json";
import it from "@/i18n/game/it.json";
import {
  defaultLocale,
  isLocale,
  pathWithLocale,
  persistLocaleCookie,
  type Locale,
} from "./locale";

interface Dictionary {
  [key: string]: string | Dictionary;
}

/**
 * Dictionnaires de l'interface de jeu (une langue par fichier JSON, mêmes clés partout :
 * la parité est vérifiée par `npm run test:i18n`). La langue vient de l'URL (`/[locale]/…`).
 */
const translations: Record<Locale, Dictionary> = { fr, en, es, de, it };

/** Ordre de repli si une clé manque dans la langue courante. */
const FALLBACKS: Locale[] = ["en", "fr"];

export type TranslationParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function resolveKey(dictionary: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let current: Dictionary | string | undefined = dictionary;
  for (const part of parts) {
    if (!current || typeof current === "string") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

/** Remplace les `{nom}` d'un texte par les valeurs fournies (laisse le marqueur si absent). */
function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Traduit une clé hors composant (tests, utilitaires) avec le même repli que le provider. */
export function translate(locale: Locale, key: string, params?: TranslationParams): string {
  const chain: Locale[] = [locale, ...FALLBACKS.filter((l) => l !== locale)];
  for (const candidate of chain) {
    const found = resolveKey(translations[candidate], key);
    if (found !== undefined) return interpolate(found, params);
  }
  return key;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const urlLocale = useLocale();
  // La langue du jeu suit toujours celle de l'URL : un seul sélecteur, un seul état.
  const locale: Locale = isLocale(urlLocale) ? urlLocale : defaultLocale;

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      persistLocaleCookie(next);
      router.push(pathWithLocale(pathname, next));
      router.refresh();
    },
    [locale, pathname, router],
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n doit être utilisé dans un I18nProvider");
  }
  return context;
}
