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
import { AccountService } from './account.service';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/account.dto';
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
    private readonly account: AccountService,
  ) {}

  /**
   * POST /auth/register
   * Inscription d'un nouvel utilisateur
   */
  @Post('register')
  @RateLimit('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    // Email de confirmation hors de la réponse : l'inscription ne dépend pas du SMTP
    void this.account.sendVerificationEmail(result.user);
    return result;
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

  /** POST /auth/forgot-password : réponse identique que le compte existe ou non. */
  @Post('forgot-password')
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.account.forgotPassword(dto.email);
  }

  /** POST /auth/resend-confirmation : renvoi public du lien de confirmation d'un compte non activé. */
  @Post('resend-confirmation')
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  resendConfirmation(@Body() dto: ForgotPasswordDto) {
    return this.account.resendConfirmation(dto.email);
  }

  /** POST /auth/reset-password : jeton reçu par email + nouveau mot de passe. */
  @Post('reset-password')
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.account.resetPassword(dto.token, dto.password);
  }

  /** POST /auth/verify-email : confirme l'adresse ou un changement d'adresse. */
  @Post('verify-email')
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: TokenDto) {
    return this.account.verifyEmail(dto.token);
  }

  /** POST /auth/resend-verification : renvoie le lien de confirmation (joueur connecté). */
  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  resendVerification(@CurrentUser('id') userId: string) {
    return this.account.resendVerification(userId);
  }

  /** POST /auth/change-password : révoque les autres sessions. */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('sessionId') sessionId: string,
  ) {
    return this.account.changePassword(userId, sessionId, dto.currentPassword, dto.newPassword);
  }

  /** POST /auth/change-email : envoie la confirmation à la nouvelle adresse. */
  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  @RateLimit('account')
  @HttpCode(HttpStatus.OK)
  changeEmail(@Body() dto: ChangeEmailDto, @CurrentUser('id') userId: string) {
    return this.account.requestEmailChange(userId, dto.currentPassword, dto.newEmail);
  }
}
