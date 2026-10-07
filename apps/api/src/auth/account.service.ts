import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { MailService } from '../mail/mail.service';
import { SetupStateService } from '../setup/setup-state.service';
import { lockUser } from '../common/atomic';
import type { Prisma } from '@prisma/client';

type TokenType = 'verify_email' | 'reset_password' | 'change_email';

const TTL_MS: Record<TokenType, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
  change_email: 24 * 60 * 60 * 1000,
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Parcours de compte par email (SCOPE-01) : vérification de l'adresse, mot de passe oublié,
 * changement de mot de passe et d'adresse.
 *
 * Jetons : 32 octets aléatoires, seule l'empreinte SHA-256 est stockée, usage unique pris en charge
 * de façon atomique, durée limitée. Les réponses de « mot de passe oublié » ne révèlent jamais
 * l'existence d'un compte. Un changement de mot de passe révoque les autres sessions.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly mail: MailService,
    private readonly gameEvents: GameEventsGateway,
    private readonly config: ConfigService,
    private readonly setupState: SetupStateService,
  ) {}

  /** Adresse publique du site web, pour les liens des emails. */
  private webBaseUrl() {
    const origins = (this.config.get<string>('WEB_ORIGINS') || this.config.get<string>('WEB_ORIGIN') || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin && origin !== '*');
    return (origins[0] || 'http://localhost:3000').replace(/\/+$/, '');
  }

  /** Refuse tôt, avant d'invalider des jetons existants, quand aucun email ne pourra partir. */
  private async requireMail() {
    if (!(await this.mail.isConfigured())) {
      throw new ServiceUnavailableException("L'envoi d'emails n'est pas configuré");
    }
  }

  private async issueToken(userId: string, type: TokenType, email: string | null) {
    const token = randomBytes(32).toString('base64url');
    // Un seul jeton actif par utilisateur et par type : le précédent est invalidé
    await this.database.$transaction([
      this.database.emailToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.database.emailToken.create({
        data: {
          userId,
          type,
          email,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /** Envoie le lien de vérification ; ne lève jamais (inscription et renvoi ne dépendent pas du SMTP). */
  async sendVerificationEmail(user: { id: string; email: string; username: string }) {
    try {
      await this.requireMail();
      const token = await this.issueToken(user.id, 'verify_email', user.email);
      await this.mail.send({
        to: user.email,
        subject: 'XNova Reforged - confirmez votre adresse email',
        text:
          `Bonjour ${user.username},\n\nConfirmez votre adresse email avec ce lien (valable 24 heures) :\n` +
          `${this.webBaseUrl()}/verify-email?token=${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      });
      return true;
    } catch (error) {
      // SMTP non configuré : situation normale en développement, pas une alerte
      const log = error instanceof ServiceUnavailableException ? 'debug' : 'warn';
      this.logger[log](`Email de vérification non envoyé : ${(error as Error).message}`);
      return false;
    }
  }

  /** Renvoi à la demande d'un joueur connecté : l'indisponibilité du SMTP est signalée. */
  async resendVerification(userId: string) {
    const user = await this.database.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Votre adresse email est déjà confirmée');
    }
    await this.requireMail();
    const token = await this.issueToken(user.id, 'verify_email', user.email);
    await this.mail.send({
      to: user.email,
      subject: 'XNova Reforged - confirmez votre adresse email',
      text:
        `Bonjour ${user.username},\n\nConfirmez votre adresse email avec ce lien (valable 24 heures) :\n` +
        `${this.webBaseUrl()}/verify-email?token=${token}`,
    });
    return { message: 'Email de confirmation envoyé' };
  }

  /**
   * Renvoi public du lien de confirmation (le compte n'a pas encore de session) : réponse identique que
   * le compte existe, soit déjà confirmé ou non.
   */
  resendConfirmation(email: string) {
    void (async () => {
      const user = await this.database.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, emailVerifiedAt: null },
      });
      if (user) await this.sendVerificationEmail(user);
    })().catch((error) => this.logger.warn(`Renvoi de confirmation échoué : ${(error as Error).message}`));
    return { message: "Si un compte non confirmé correspond à cette adresse, un nouvel email de confirmation a été envoyé" };
  }

  /** Réponse identique que le compte existe ou non ; l'envoi se fait hors de la réponse. */
  forgotPassword(email: string) {
    void this.sendResetEmail(email).catch((error) => {
      const log = error instanceof ServiceUnavailableException ? 'debug' : 'warn';
      this.logger[log](`Réinitialisation non envoyée : ${(error as Error).message}`);
    });
    return { message: 'Si un compte correspond à cette adresse, un email de réinitialisation a été envoyé' };
  }

  private async sendResetEmail(email: string) {
    const user = await this.database.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) return;
    await this.requireMail();
    const token = await this.issueToken(user.id, 'reset_password', null);
    await this.mail.send({
      to: user.email,
      subject: 'XNova Reforged - réinitialisation du mot de passe',
      text:
        `Bonjour ${user.username},\n\nPour choisir un nouveau mot de passe, utilisez ce lien (valable 1 heure) :\n` +
        `${this.webBaseUrl()}/reset-password?token=${token}\n\n` +
        `Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.`,
    });
  }

  /** Consomme un jeton valide et non utilisé ; retourne null sinon (un seul usage, même en concurrence). */
  private async consumeToken(token: string, types: TokenType[], client: Pick<Prisma.TransactionClient, 'emailToken'> = this.database) {
    const hash = hashToken(token);
    const row = await client.emailToken.findUnique({ where: { tokenHash: hash } });
    if (!row || !types.includes(row.type as TokenType)) return null;
    const claimed = await client.emailToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    return claimed.count === 1 ? row : null;
  }

  async resetPassword(token: string, newPassword: string) {
    const row = await this.consumeToken(token, ['reset_password']);
    if (!row) {
      throw new BadRequestException('Lien invalide ou expiré');
    }
    const hashed = await argon2.hash(newPassword);
    await this.database.user.update({ where: { id: row.userId }, data: { password: hashed } });
    await this.revokeSessions(row.userId);
    return { message: 'Mot de passe modifié, vous pouvez vous connecter' };
  }

  async changePassword(userId: string, currentSessionId: string, currentPassword: string, newPassword: string) {
    const user = await this.database.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.password, currentPassword))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien");
    }
    const hashed = await argon2.hash(newPassword);
    await this.database.user.update({ where: { id: userId }, data: { password: hashed } });
    // Les autres appareils sont déconnectés ; la session courante reste valide
    await this.revokeSessions(userId, currentSessionId);
    // Les liens de réinitialisation déjà envoyés ne servent plus
    await this.database.emailToken.updateMany({
      where: { userId, type: 'reset_password', usedAt: null },
      data: { usedAt: new Date() },
    });
    return { message: 'Mot de passe modifié' };
  }

  async requestEmailChange(userId: string, currentPassword: string, newEmail: string) {
    const user = await this.database.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.password, currentPassword))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException("C'est déjà votre adresse email");
    }
    const taken = await this.database.user.findFirst({
      where: { email: { equals: newEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    await this.requireMail();
    const token = await this.issueToken(userId, 'change_email', newEmail);
    await this.mail.send({
      to: newEmail,
      subject: 'XNova Reforged - confirmez votre nouvelle adresse email',
      text:
        `Bonjour ${user.username},\n\nConfirmez cette adresse comme nouvelle adresse de votre compte (lien valable 24 heures) :\n` +
        `${this.webBaseUrl()}/verify-email?token=${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    });
    // Alerte sur l'ancienne adresse : un changement non voulu doit pouvoir être repéré
    await this.mail
      .send({
        to: user.email,
        subject: "XNova Reforged - demande de changement d'adresse email",
        text:
          `Bonjour ${user.username},\n\nUne demande de changement de votre adresse email vers ${newEmail} a été faite. ` +
          `Elle ne prendra effet qu'après confirmation depuis la nouvelle adresse.\n` +
          `Si ce n'est pas vous, changez votre mot de passe sans attendre.`,
      })
      .catch((error) => this.logger.warn(`Alerte ancienne adresse non envoyée : ${(error as Error).message}`));

    return { message: 'Un email de confirmation a été envoyé à la nouvelle adresse' };
  }

  /** Correction administrative : révocation et nouveau lien atomiques, même en mode développement. */
  async adminChangeEmail(actorId: string, userId: string, email: string) {
    await this.requireMail();
    try {
      await this.database.$transaction(async tx => {
        await lockUser(tx, userId);
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Joueur introuvable');
        const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
        if (!actor || !['ADMIN', 'SUPER_ADMIN'].includes(actor.role) || (user.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN')) {
          throw new ForbiddenException('Droits insuffisants pour modifier l’adresse de ce joueur');
        }
        if (user.email.toLowerCase() === email.toLowerCase()) throw new BadRequestException('Cette adresse est déjà utilisée par ce joueur');
        const taken = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
        if (taken) throw new ConflictException('Cet email est déjà utilisé');
        const now = new Date();
        const token = randomBytes(32).toString('base64url');
        await tx.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: null, mustVerifyEmail: true } });
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.emailToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
        await tx.emailToken.create({ data: { userId, type: 'verify_email', email, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TTL_MS.verify_email) } });
        await tx.adminAuditLog.create({ data: { userId: actorId, action: 'update_player_email', changes: { targetId: userId, targetUsername: user.username, before: user.email, after: email } } });
        await this.mail.send({
          to: email, subject: 'XNova Reforged - confirmez votre nouvelle adresse email',
          text: `Bonjour ${user.username},\n\nVotre adresse email a été modifiée par un administrateur. Confirmez cette adresse pour pouvoir vous connecter (lien valable 24 heures) :\n${this.webBaseUrl()}/verify-email?token=${token}`,
        });
      }, { timeout: 45000 });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Cet email est déjà utilisé');
      throw error;
    }
    this.gameEvents.disconnectUser(userId);
    return { success: true, message: 'Adresse modifiée. Le joueur doit confirmer le nouvel email avant de se reconnecter.' };
  }

  async verifyEmail(token: string) {
    const candidate = await this.database.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!candidate) throw new BadRequestException('Lien invalide ou expiré');
    let result;
    try {
      result = await this.database.$transaction(async tx => {
        // Sérialise confirmation et changement administratif : un ancien lien ne peut pas
        // réactiver le compte après correction de son adresse.
        await lockUser(tx, candidate.userId);
        const row = await this.consumeToken(token, ['verify_email', 'change_email'], tx);
        if (!row || !row.email) throw new BadRequestException('Lien invalide ou expiré');
        const user = await tx.user.findUnique({ where: { id: row.userId } });
        if (!user || (row.type === 'verify_email' && user.email.toLowerCase() !== row.email.toLowerCase()) ||
          (row.type === 'change_email' && user.mustVerifyEmail)) {
          throw new BadRequestException('Lien invalide ou expiré');
        }
        if (user.mustVerifyEmail) {
          // Invalide aussi les liens émis par une demande déjà en vol lors de la correction.
          await tx.emailToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
        }
        await tx.user.update({ where: { id: user.id }, data: {
          ...(row.type === 'change_email' ? { email: row.email } : {}),
          emailVerifiedAt: new Date(), mustVerifyEmail: false,
        } });
        return { id: user.id, type: row.type, previousEmail: user.email, email: row.email, username: user.username };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Cet email est déjà utilisé');
      throw error;
    }
    if (result.type === 'verify_email') {
      await this.setupState.completeIfReady(result.id);
      return { message: 'Adresse email confirmée', type: 'verify_email' as const };
    }
    await this.mail.send({
      to: result.previousEmail,
      subject: "XNova Reforged - votre adresse email a été modifiée",
      text: `Bonjour ${result.username},\n\nL'adresse email de votre compte est désormais ${result.email}.`,
    }).catch(() => undefined);
    return { message: 'Adresse email modifiée', type: 'change_email' as const };
  }

  /** Révoque les sessions actives (sauf éventuellement la courante) et coupe leurs sockets. */
  private async revokeSessions(userId: string, exceptSessionId?: string) {
    const active = await this.database.session.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    if (active.length === 0) return;
    await this.database.session.updateMany({
      where: { id: { in: active.map((s) => s.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    active.forEach((session) => this.gameEvents.disconnectSession(session.id));
  }
}
