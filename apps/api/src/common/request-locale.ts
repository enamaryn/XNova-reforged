import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { DEFAULT_LOCALE, isSupportedLocale, localizeItem, type SupportedLocale } from '@xnova/game-config';

/**
 * Langue de la requête en cours (en-tête `X-Locale` envoyé par l'interface). Sert à localiser les noms et
 * descriptions du jeu et les libellés d'effets servis par l'API ; absente, les textes restent en français
 * (langue source de `@xnova/game-config`). Les journaux et messages d'erreur ne sont pas concernés.
 */
const storage = new AsyncLocalStorage<{ locale: SupportedLocale | null }>();

export function requestLocaleMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers['x-locale'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const locale = isSupportedLocale(value) ? value : null;
  storage.run({ locale }, next);
}

export function currentLocale(): SupportedLocale {
  return storage.getStore()?.locale ?? DEFAULT_LOCALE;
}

/** Langue explicitement demandée par la requête (null si l'interface n'en a pas envoyé). */
export function requestLocaleOrNull(): SupportedLocale | null {
  return storage.getStore()?.locale ?? null;
}

/** Exécute `fn` avec une langue donnée (tests et traitements hors requête HTTP). */
export function withLocale<T>(locale: SupportedLocale, fn: () => T): T {
  return storage.run({ locale }, fn);
}

type Named = { id: number; name: string; description?: string };

export const itemName = (item: Named): string => localizeItem(item.id, currentLocale(), item).name;
export const itemDescription = (item: Named): string => localizeItem(item.id, currentLocale(), item).description;

/** Nom localisé d'un identifiant ; `fallback` (souvent le nom français, ou indéfini) si la langue est le français. */
export function itemNameById(id: number, fallback?: string): string | undefined {
  const locale = currentLocale();
  if (locale === DEFAULT_LOCALE) return fallback;
  const localized = localizeItem(id, locale, { name: fallback ?? '' }).name;
  return localized || fallback;
}
