// DSN public compilé (NEXT_PUBLIC_SENTRY_DSN), jamais versionné. Sans DSN, le SDK n'est ni chargé ni exécuté :
// il pesait ~120 Ko de JavaScript sur chaque page (et ~0,5 s de calcul sur mobile) pour rien. Un Sentry activé
// par l'administrateur après compilation est chargé à l'exécution par `lib/monitoring/sentry-loader.ts`.
type SentryModule = typeof import('@sentry/nextjs');

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentry: SentryModule | null = null;

if (dsn) {
  void import('@sentry/nextjs')
    .then((module) => {
      module.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        debug: false,
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
      });
      sentry = module;
    })
    .catch(() => undefined);
}

/** Suivi des navigations du routeur App Router (actif seulement lorsque Sentry est chargé). */
export const onRouterTransitionStart = (href: string, navigationType: 'push' | 'replace' | 'traverse') => {
  sentry?.captureRouterTransitionStart(href, navigationType);
};
