import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
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
    const tokens = await this.generateTokens(user.id, user.username);

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
    if (user.bannedAt && (!user.bannedUntil || user.bannedUntil > now)) {
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
    const tokens = await this.generateTokens(user.id, user.username);

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
   * Rafraîchir le token d'accès
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Vérifier et décoder le refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Vérifier que l'utilisateur existe toujours
      const user = await this.database.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      // Générer un nouveau access token
      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          username: user.username,
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
        } as any,
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
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

  /**
   * Générer les tokens JWT (access + refresh)
   */
  private async generateTokens(userId: string, username: string) {
    const payload = { sub: userId, username };

    const [accessToken, refreshToken] = await Promise.all([
      // Access token (courte durée)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
      } as any),
      // Refresh token (longue durée)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d',
      } as any),
    ]);

    return {
      accessToken,
      refreshToken,
    };
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
