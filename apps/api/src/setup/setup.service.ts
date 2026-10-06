import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AccountService } from '../auth/account.service';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateConfigDto } from '../admin/dto/update-config.dto';
import { UpdateSmtpDto } from '../admin/dto/update-smtp.dto';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { SmtpConfigService } from '../mail/smtp-config.service';
import { ServerConfigService } from '../server-config/server-config.service';
import {
  SETUP_KEYS,
  SetupDb,
  clearProgressFlag,
  readProgressFlags,
  writeProgressFlag,
} from './setup-core';

/** Champs SMTP dont la modification invalide le test d'envoi déjà réussi. */
const SMTP_CONNECTION_FIELDS = ['enabled', 'host', 'port', 'secure', 'username', 'fromEmail', 'fromName', 'password'];

/**
 * Parcours d'installation du serveur (SETUP-01) : SMTP, réglages, compte super admin. Chaque méthode suppose
 * que le code d'installation a déjà été contrôlé (SetupGuard). La confirmation de l'adresse du super admin
 * (AccountService.verifyEmail) clôt l'installation.
 */
@Injectable()
export class SetupService {
  constructor(
    private readonly database: DatabaseService,
    private readonly smtpConfig: SmtpConfigService,
    private readonly mail: MailService,
    private readonly serverConfig: ServerConfigService,
    private readonly authService: AuthService,
    private readonly account: AccountService,
  ) {}

  private get db(): SetupDb {
    return this.database as unknown as SetupDb;
  }

  /** Progression complète : permet de reprendre le parcours après un rechargement de page. */
  async getState() {
    const flags = await readProgressFlags(this.db);
    const smtp = await this.smtpConfig.getPublic();
    const settings = await this.serverConfig.getConfig(true);

    let admin: { username: string; email: string; verified: boolean } | null = null;
    if (flags.adminId) {
      const user = await this.database.user.findUnique({
        where: { id: flags.adminId },
        select: { username: true, email: true, emailVerifiedAt: true },
      });
      if (user) admin = { username: user.username, email: user.email, verified: !!user.emailVerifiedAt };
    }

    return {
      completed: false,
      smtp: {
        ...smtp,
        configured: smtp.enabled && !!smtp.host && !!smtp.fromEmail,
        tested: !!flags.smtpTestedAt,
      },
      settings: { saved: !!flags.settingsSavedAt, values: settings },
      admin,
    };
  }

  async saveSmtp(dto: UpdateSmtpDto) {
    // Le parcours configure toujours l'envoi : l'activation est implicite
    const merged = { ...(await this.smtpConfig.getPublic()), ...dto, enabled: true };
    if (!merged.host || !merged.fromEmail) {
      throw new BadRequestException("L'hôte et l'adresse d'expédition sont requis");
    }
    const changed = await this.smtpConfig.update({ ...dto, enabled: true });
    if (changed.some((field) => SMTP_CONNECTION_FIELDS.includes(field))) {
      await clearProgressFlag(this.db, 'smtpTestedAt');
    }
    return this.getState();
  }

  async testSmtp(to: string) {
    try {
      await this.mail.send({
        to,
        subject: "XNova Reforged - test de la configuration SMTP (installation)",
        text: "Si vous lisez ce message, l'envoi d'emails du serveur fonctionne. Vous pouvez continuer l'installation.",
      });
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      throw new BadRequestException(`Échec de l'envoi : ${(error as Error)?.message ?? 'erreur inconnue'}`);
    }
    await writeProgressFlag(this.db, SETUP_KEYS.smtpTestedAt, new Date().toISOString());
    return { success: true, to };
  }

  async saveSettings(dto: UpdateConfigDto) {
    await this.serverConfig.applyConfig(dto);
    await writeProgressFlag(this.db, SETUP_KEYS.settingsSavedAt, new Date().toISOString());
    return this.getState();
  }

  /**
   * Crée (ou remplace, tant qu'il n'est pas confirmé) le super admin et lui envoie le lien de confirmation.
   * Exige un envoi d'email déjà testé : le lien final prouve que tout fonctionne de bout en bout.
   */
  async createAdmin(dto: RegisterDto) {
    const flags = await readProgressFlags(this.db);
    if (!flags.smtpTestedAt) {
      throw new ConflictException("Testez d'abord l'envoi d'emails (étape SMTP)");
    }

    // Compte précédent du parcours, pas encore confirmé (faute de frappe dans l'adresse, par exemple) : remplacé
    if (flags.adminId) {
      const previous = await this.database.user.findUnique({
        where: { id: flags.adminId },
        select: { emailVerifiedAt: true },
      });
      if (previous && !previous.emailVerifiedAt) {
        await this.database.user.delete({ where: { id: flags.adminId } });
      }
      await clearProgressFlag(this.db, 'adminId');
    }

    const user = await this.authService.createSetupAdmin(dto);
    await writeProgressFlag(this.db, SETUP_KEYS.adminId, user.id);

    const sent = await this.account.sendVerificationEmail(user);
    if (!sent) {
      throw new ServiceUnavailableException(
        "Compte créé mais l'email de confirmation n'a pas pu partir : vérifiez le SMTP puis renvoyez le lien",
      );
    }
    return this.getState();
  }

  async resendAdminEmail() {
    const { adminId } = await readProgressFlags(this.db);
    if (!adminId) throw new ConflictException("Aucun compte super admin n'a encore été créé");
    const user = await this.database.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, username: true, emailVerifiedAt: true },
    });
    if (!user) throw new ConflictException("Aucun compte super admin n'a encore été créé");
    if (user.emailVerifiedAt) throw new ConflictException('Le compte est déjà confirmé');
    const sent = await this.account.sendVerificationEmail(user);
    if (!sent) throw new ServiceUnavailableException("L'email de confirmation n'a pas pu partir");
    return { message: 'Email de confirmation renvoyé' };
  }
}
