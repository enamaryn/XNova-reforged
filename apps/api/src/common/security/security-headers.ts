import type { NextFunction, Request, Response } from 'express';

/**
 * En-têtes de sécurité pour une API JSON (équivalent minimal de helmet, SEC-04).
 * `swagger` assouplit la CSP : l'interface Swagger a besoin de scripts et styles inline.
 */
export function securityHeaders(options: { production: boolean; swagger: boolean }) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (!options.swagger) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
    if (options.production) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  };
}
