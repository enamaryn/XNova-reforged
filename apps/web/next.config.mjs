import os from "node:os";
import { withSentryConfig } from '@sentry/nextjs';
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

export default withSentryConfig(withNextIntl(nextConfig), sentryWebpackPluginOptions);
