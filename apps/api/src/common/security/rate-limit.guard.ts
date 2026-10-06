import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

export type RateLimitRoute = 'login' | 'register' | 'account' | 'setup';

export const RATE_LIMIT_KEY = 'rate-limit-route';
/** Soumet la route à la limitation de débit d'authentification (SEC-04). */
export const RateLimit = (route: RateLimitRoute) => SetMetadata(RATE_LIMIT_KEY, route);

interface Bucket {
  count: number;
  resetAt: number;
}

const DEFAULTS: Record<RateLimitRoute, { max: number; windowMs: number }> = {
  login: { max: 10, windowMs: 60_000 },
  register: { max: 5, windowMs: 60_000 },
  // Mot de passe oublié, réinitialisation, vérification, changements de compte
  account: { max: 10, windowMs: 60_000 },
  // Parcours d'installation : code d'installation de 79 bits, la limite évite surtout l'abus
  setup: { max: 60, windowMs: 60_000 },
};

/**
 * Limitation de débit en mémoire pour login/register.
 *
 * - par adresse IP ;
 * - pour le login, aussi par identifiant visé (credential stuffing sur un compte, quelle que soit l'IP).
 * Réponse 429 avec `Retry-After`, puis récupération à l'expiration de la fenêtre.
 * Limite : compteurs par processus (une instance) ; à déplacer vers Redis avec plusieurs instances.
 * Configuration : RATE_LIMIT_<ROUTE>_MAX et RATE_LIMIT_<ROUTE>_WINDOW_MS, lues à chaque requête.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const route = this.reflector.get<RateLimitRoute | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!route) return true;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { max, windowMs } = this.limits(route);
    const now = Date.now();
    this.sweep(now);

    const keys = [`${route}:ip:${request.ip}`];
    if (route === 'login') {
      const identifier = request.body?.identifier;
      if (typeof identifier === 'string' && identifier.length > 0) {
        keys.push(`${route}:id:${identifier.toLowerCase().slice(0, 100)}`);
      }
    }

    if (route === 'account') {
      const email = request.body?.email;
      if (typeof email === 'string' && email.length > 0) {
        keys.push(`${route}:email:${email.toLowerCase().slice(0, 100)}`);
      }
    }

    let retryAfterMs = 0;
    for (const key of keys) {
      const bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        bucket.count += 1;
        if (bucket.count > max) {
          retryAfterMs = Math.max(retryAfterMs, bucket.resetAt - now);
        }
      }
    }

    if (retryAfterMs > 0) {
      const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      response.setHeader('Retry-After', String(seconds));
      throw new HttpException(
        'Trop de tentatives, reessayez plus tard',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private limits(route: RateLimitRoute) {
    const name = route.toUpperCase();
    const max = Number(this.config.get(`RATE_LIMIT_${name}_MAX`));
    const windowMs = Number(this.config.get(`RATE_LIMIT_${name}_WINDOW_MS`));
    return {
      max: Number.isFinite(max) && max > 0 ? max : DEFAULTS[route].max,
      windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULTS[route].windowMs,
    };
  }

  /** Purge périodique des compteurs expirés (évite la croissance mémoire). */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000 && this.buckets.size < 10_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
