import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { isBanned } from './ban.util';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { username, email, password } = registerDto;

    // Vérifier si l'username existe déjà
    const existingUsername = await this.database.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      throw new ConflictException('Ce nom d\'utilisateur est déjà pris');
    }

    // Vérifier si l'email existe déjà
    const existingEmail = await this.database.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe avec Argon2
    const hashedPassword = await argon2.hash(password);

    // Créer l'utilisateur
    const user = await this.database.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        points: 0,
        rank: 0,
      },
    });

    // Créer la planète de départ
    await this.createStarterPlanet(user.id);

    // Générer les tokens JWT
    const tokens = await this.createSessionTokens(user.id, user.username);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        points: user.points,
        rank: user.rank,
        role: user.role,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { identifier, password } = loginDto;

    // Chercher l'utilisateur par username OU email
    const user = await this.database.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    const now = new Date();
    if (isBanned(user, now)) {
      throw new UnauthorizedException('Compte suspendu temporairement');
    }

    if (user.bannedUntil && user.bannedUntil <= now && user.bannedAt) {
      await this.database.user.update({
        where: { id: user.id },
        data: {
          bannedUntil: null,
          banReason: null,
          bannedAt: null,
        },
      });
    }

    // Vérifier le mot de passe avec Argon2
    const isPasswordValid = await argon2.verify(user.password, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // Mettre à jour la date de dernière activité
    await this.database.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    // Générer les tokens JWT
    const tokens = await this.createSessionTokens(user.id, user.username);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        points: user.points,
        rank: user.rank,
        role: user.role,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Rafraîchir les tokens (rotation du refresh token, SEC-03).
   *
   * Le refresh token est à usage unique : il est remplacé à chaque appel. Un refresh token
   * déjà consommé (rejeu), une session révoquée ou expirée, ou un compte suspendu sont refusés ;
   * le rejeu révoque en plus la session.
   */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const invalid = new UnauthorizedException('Refresh token invalide ou expiré');

    let payload: { sub?: string; sid?: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw invalid;
    }
    if (!payload?.sub || !payload.sid) throw invalid;

    const session = await this.database.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: { id: true, username: true, bannedAt: true, bannedUntil: true },
        },
      },
    });

    const now = new Date();
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now ||
      isBanned(session.user, now)
    ) {
      throw invalid;
    }

    const next = await this.signTokens(session.user.id, session.user.username, session.id);

    // Rotation atomique : seul le porteur du refresh token courant l'emporte
    const rotated = await this.database.session.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        refreshHash: this.hashToken(refreshToken),
      },
      data: { refreshHash: this.hashToken(next.refreshToken), lastRotatedAt: now },
    });

    if (rotated.count !== 1) {
      // Refresh token déjà consommé : possible vol, on coupe la session
      await this.revokeSession(session.id);
      throw invalid;
    }

    return next;
  }

  /** Révoque une session (déconnexion). */
  async revokeSession(sessionId: string) {
    await this.database.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Révoque toutes les sessions actives d'un utilisateur (bannissement). */
  async revokeAllUserSessions(userId: string) {
    await this.database.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Récupérer les informations de l'utilisateur connecté
   */
  async getMe(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        points: true,
        rank: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        planets: {
          select: {
            id: true,
            name: true,
            galaxy: true,
            system: true,
            position: true,
          },
          orderBy: {
            createdAt: 'asc', // Planète principale en premier
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  /** Crée une session serveur et les tokens associés (claim `sid`). */
  private async createSessionTokens(userId: string, username: string) {
    const sessionId = randomUUID();
    const tokens = await this.signTokens(userId, username, sessionId);
    const decoded = this.jwtService.decode(tokens.refreshToken) as { exp: number };

    await this.database.session.create({
      data: {
        id: sessionId,
        userId,
        refreshHash: this.hashToken(tokens.refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return tokens;
  }

  /** Signe access + refresh token pour une session donnée (jti unique : un refresh token = un usage). */
  private async signTokens(userId: string, username: string, sessionId: string) {
    const payload = { sub: userId, username, sid: sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
      } as any),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d',
        } as any,
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Créer la planète de départ pour un nouvel utilisateur
   */
  private async createStarterPlanet(userId: string) {
    // Position aléatoire dans l'univers
    const galaxy = Math.floor(Math.random() * 9) + 1; // 1-9
    const system = Math.floor(Math.random() * 499) + 1; // 1-499
    const position = Math.floor(Math.random() * 15) + 1; // 1-15

    // Vérifier si la position est déjà prise
    const existingPlanet = await this.database.planet.findUnique({
      where: {
        galaxy_system_position: {
          galaxy,
          system,
          position,
        },
      },
    });

    // Si la position est prise, réessayer de manière récursive
    if (existingPlanet) {
      return this.createStarterPlanet(userId);
    }

    // Créer la planète avec ressources de départ
    const config = await this.serverConfig.getConfig();

    await this.database.planet.create({
      data: {
        userId,
        name: 'Planète Mère',
        galaxy,
        system,
        position,
        planetType: 'normal',
        metal: 500,
        crystal: 500,
        deuterium: 0,
        fieldsMax: config.planetSize,
        fieldsUsed: 0,
      },
    });
  }
}
