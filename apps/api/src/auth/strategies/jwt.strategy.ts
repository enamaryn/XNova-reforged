import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';
import { isBanned } from '../ban.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly database: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Valide le payload du JWT et retourne l'utilisateur
   * Cette méthode est automatiquement appelée par Passport après vérification du token
   */
  async validate(payload: { sub: string; username: string; sid?: string }) {
    // SEC-03 : le token doit référencer une session serveur active (pas de token sans `sid`)
    if (!payload.sid) {
      throw new UnauthorizedException('Session invalide');
    }

    const session = await this.database.session.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            points: true,
            rank: true,
            role: true,
            bannedAt: true,
            bannedUntil: true,
            mustVerifyEmail: true,
          },
        },
      },
    });

    const now = new Date();
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new UnauthorizedException('Session invalide ou révoquée');
    }

    const { bannedAt, bannedUntil, mustVerifyEmail, ...user } = session.user;
    if (mustVerifyEmail) throw new UnauthorizedException('Adresse email à confirmer');
    if (isBanned({ bannedAt, bannedUntil }, now)) {
      throw new UnauthorizedException('Compte suspendu');
    }

    // L'objet retourné sera attaché à request.user
    return { ...user, sessionId: payload.sid };
  }
}
