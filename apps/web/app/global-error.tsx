'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/** Textes de l'écran d'erreur global : hors du contexte de langue, donc dictionnaire local (cinq langues). */
const TEXTS = {
  fr: { title: 'Une erreur est survenue', body: 'Le problème a été signalé. Vous pouvez réessayer.', retry: 'Réessayer' },
  en: { title: 'Something went wrong', body: 'The problem has been reported. You can try again.', retry: 'Try again' },
  es: { title: 'Ha ocurrido un error', body: 'El problema se ha notificado. Puede intentarlo de nuevo.', retry: 'Reintentar' },
  de: { title: 'Es ist ein Fehler aufgetreten', body: 'Das Problem wurde gemeldet. Sie können es erneut versuchen.', retry: 'Erneut versuchen' },
  it: { title: 'Si è verificato un errore', body: 'Il problema è stato segnalato. Puoi riprovare.', retry: 'Riprova' },
} as const;

type TextLocale = keyof typeof TEXTS;

/** Langue de l'URL (`/<langue>/…`), à défaut celle du navigateur, à défaut le français. */
function detectLocale(): TextLocale {
  if (typeof window === 'undefined') return 'fr';
  const fromPath = window.location.pathname.split('/')[1];
  if (fromPath in TEXTS) return fromPath as TextLocale;
  const fromBrowser = window.navigator.language?.slice(0, 2).toLowerCase();
  return fromBrowser in TEXTS ? (fromBrowser as TextLocale) : 'fr';
}

/** Dernier filet : erreur de rendu non rattrapée. Remontée à Sentry (si actif) puis message au joueur. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const locale = detectLocale();
  const text = TEXTS[locale];

  return (
    <html lang={locale}>
      <body style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#020617', color: '#e2e8f0' }}>
        <h1>{text.title}</h1>
        <p>{text.body}</p>
        <button onClick={() => reset()} style={{ padding: '0.5rem 1rem' }}>
          {text.retry}
        </button>
      </body>
    </html>
  );
}
