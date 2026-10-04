import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { RateLimit, RateLimitGuard } from '../common/security/rate-limit.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  /**
   * POST /auth/register
   * Inscription d'un nouvel utilisateur
   */
  @Post('register')
  @RateLimit('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * POST /auth/login
   * Connexion d'un utilisateur existant
   */
  @Post('login')
  @RateLimit('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * POST /auth/refresh
   * Rafraîchir le token d'accès
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  /**
   * GET /auth/me
   * Récupérer les informations de l'utilisateur connecté
   * Route protégée par JWT
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  /**
   * POST /auth/logout
   * Révoque la session serveur courante et coupe ses sockets
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('sessionId') sessionId: string) {
    await this.authService.revokeSession(sessionId);
    this.gameEvents.disconnectSession(sessionId);
    return {
      message: 'Déconnexion réussie',
    };
  }
}
