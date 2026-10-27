import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from './i18n/config'

const protectedPaths = ["/overview", "/buildings", "/research", "/fleet", "/galaxy", "/shipyard", "/defense", "/alliance", "/messages", "/reports", "/statistics", "/settings", "/help"];

/** Langue du serveur (choisie à l'installation), lue sur l'API et gardée 60 s en mémoire. */
let cachedServerLanguage: { value: (typeof locales)[number]; expires: number } | null = null;

async function getServerLanguage(request: NextRequest): Promise<(typeof locales)[number]> {
  if (cachedServerLanguage && cachedServerLanguage.expires > Date.now()) return cachedServerLanguage.value;
  const env = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  const base = env.startsWith('/') ? `${request.nextUrl.origin}${env}` : env || 'http://localhost:3001';
  let value: (typeof locales)[number] = defaultLocale;
  let ttl = 5_000; // échec : on réessaie vite
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1_500);
    const response = await fetch(`${base}/setup/status`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (response.ok) {
      const body = (await response.json()) as { language?: string };
      if (body.language && (locales as readonly string[]).includes(body.language)) {
        value = body.language as (typeof locales)[number];
        ttl = 60_000;
      }
    }
  } catch {
    // API injoignable : langue par défaut de l'interface
  }
  cachedServerLanguage = { value, expires: Date.now() + ttl };
  return value;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Step 1: Handle locale detection and routing
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  let locale = defaultLocale;

  if (pathnameHasLocale) {
    // Extract locale from pathname
    locale = pathname.split('/')[1] as typeof locales[number];
  } else {
    // Langue choisie par le visiteur (cookie), sinon langue du serveur définie à l'installation
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value as typeof locales[number] | undefined;
    locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : await getServerLanguage(request);

    // Redirect to locale path
    const redirectUrl = new URL(`/${locale}${pathname}`, request.url);
    // Conserver la query string (ex. /fleet?mission=attack&galaxy=1 depuis la galaxie)
    redirectUrl.search = request.nextUrl.search;
    const response = NextResponse.redirect(redirectUrl);

    // Le cookie ne mémorise que le choix du visiteur : la langue du serveur peut changer ensuite
    if (cookieLocale && locales.includes(cookieLocale)) {
      response.cookies.set('NEXT_LOCALE', locale, {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      });
    }

    response.headers.set('x-locale', locale);

    return response;
  }

  // Step 2: Check authentication for protected paths
  // Remove locale prefix from pathname for auth check
  const pathnameWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
  const isProtected = protectedPaths.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  if (isProtected) {
    const token = request.cookies.get("xnova_access")?.value;
    if (!token) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Step 3: Continue with locale header set
  const response = NextResponse.next();
  response.headers.set('x-locale', locale);

  return response;
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, api, static files) et le tunnel Sentry (/monitoring, sans redirection de langue)
    '/((?!api|_next|_vercel|monitoring|.*\\..*).*)',
  ],
};
