import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from './i18n/config'

const protectedPaths = ["/overview", "/buildings", "/research", "/fleet", "/galaxy", "/shipyard", "/defense", "/alliance", "/messages", "/reports", "/statistics", "/settings"];

export function middleware(request: NextRequest) {
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
    // Get locale from cookie or Accept-Language header
    locale = request.cookies.get('NEXT_LOCALE')?.value as typeof locales[number] || defaultLocale;

    if (!locales.includes(locale)) {
      const acceptLanguage = request.headers.get('Accept-Language');
      if (acceptLanguage) {
        const preferredLocale = acceptLanguage
          .split(',')[0]
          .split('-')[0]
          .toLowerCase();

        locale = locales.includes(preferredLocale as any)
          ? (preferredLocale as typeof locales[number])
          : defaultLocale;
      } else {
        locale = defaultLocale;
      }
    }

    // Redirect to locale path
    const redirectUrl = new URL(`/${locale}${pathname}`, request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Set locale cookie
    response.cookies.set('NEXT_LOCALE', locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });

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
    // Skip all internal paths (_next, api, static files)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
