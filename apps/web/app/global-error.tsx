'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/** Dernier filet : erreur de rendu non rattrapée. Remontée à Sentry (si actif) puis message au joueur. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#020617', color: '#e2e8f0' }}>
        <h1>Une erreur est survenue</h1>
        <p>Le problème a été signalé. Vous pouvez réessayer.</p>
        <button onClick={() => reset()} style={{ padding: '0.5rem 1rem' }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
