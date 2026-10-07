/**
 * Adresse de l'API vue par le navigateur, et cible de la connexion temps réel (Socket.io).
 * Fonctions pures (sans accès à `window` ni à l'environnement) pour pouvoir être testées.
 *
 * `NEXT_PUBLIC_API_URL` (figée à la compilation) accepte :
 *  - une adresse absolue : `https://api.exemple.fr` (sous-domaine dédié) ;
 *  - un chemin relatif : `/api` (même origine, derrière un proxy inverse qui retire le préfixe) ;
 *  - `http://localhost:3001` (développement) : `localhost` est remplacé par le nom d'hôte de la page, pour
 *    joindre l'API depuis un autre poste du réseau local.
 */
export const DEFAULT_API_BASE_URL = 'http://localhost:3001';

interface PageLocation {
  protocol: string;
  hostname: string;
}

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export function resolveApiBaseUrl(envValue: string | undefined, page?: PageLocation): string {
  const env = (envValue ?? '').trim();

  if (env) {
    // Chemin relatif (même origine) : conservé tel quel, sans barre finale
    if (env.startsWith('/')) return trimTrailingSlashes(env) || '';
    try {
      const url = new URL(env);
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (page && isLocalhost) {
        const port = url.port || '3001';
        return `${url.protocol}//${page.hostname}:${port}`;
      }
      return trimTrailingSlashes(env);
    } catch {
      return trimTrailingSlashes(env);
    }
  }

  if (page) return `${page.protocol}//${page.hostname}:3001`;
  return DEFAULT_API_BASE_URL;
}

/**
 * Cible Socket.io : l'espace de noms `/game` s'ajoute à l'ORIGINE (pas au chemin), et un éventuel préfixe
 * de l'API devient le chemin du transport (`/api/socket.io`), sinon le préfixe serait pris pour un espace de noms.
 */
export function resolveSocketTarget(apiBaseUrl: string, pageOrigin: string): { url: string; path: string } {
  const absolute = new URL(apiBaseUrl || '/', pageOrigin);
  const prefix = trimTrailingSlashes(absolute.pathname);
  return { url: `${absolute.origin}/game`, path: `${prefix}/socket.io` };
}
