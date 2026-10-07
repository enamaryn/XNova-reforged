import os from "node:os";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const envOrigins = process.env.DEV_ALLOWED_ORIGINS ?? "";
const extraOrigins = envOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProd = process.env.NODE_ENV === 'production';
let localIps = [];
if (!isProd) {
  try {
    localIps = Object.values(os.networkInterfaces())
      .flatMap((interfaces) => interfaces ?? [])
      .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
      .map((iface) => `http://${iface.address}:3000`);
  } catch (error) {
    console.warn("Impossible de lire les interfaces reseau:", error);
    localIps = [];
  }
}

const allowedDevOrigins = Array.from(
  new Set([
    "http://localhost:3000",
    "http://127.0.0.0.1:3000",
    ...localIps,
    ...extraOrigins,
  ])
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Même origine pour le navigateur, y compris derrière un proxy qui ne relaie que le web.
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${apiUrl.replace(/\/+$/, '')}/:path*` }];
  },
  allowedDevOrigins,
  transpilePackages: ['@xnova/game-config'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    optimizeCss: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
};

/**
 * `withSentryConfig` : sous-chemin `@sentry/nextjs/config` à partir de Sentry 11, export du paquet avant.
 * Le suivi d'erreurs ne doit jamais empêcher le site de démarrer : si aucun des deux n'est utilisable
 * (dépendances installées différentes du lockfile, par exemple), la configuration Next est servie telle quelle.
 */
export async function resolveWithSentryConfig(importers = [
  () => import('@sentry/nextjs/config'),
  () => import('@sentry/nextjs'),
]) {
  for (const load of importers) {
    try {
      const mod = await load();
      const fn = mod.withSentryConfig ?? mod.default?.withSentryConfig;
      if (typeof fn === 'function') return fn;
    } catch {
      // essai suivant
    }
  }
  console.warn('[next.config] withSentryConfig introuvable : Sentry non configuré à la compilation (dépendances à réinstaller avec `npm ci` ?)');
  return (config) => config;
}

const withSentryConfig = await resolveWithSentryConfig();

export default withSentryConfig(withNextIntl(nextConfig), sentryWebpackPluginOptions);
