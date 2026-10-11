import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { isSupportedLocale, type SupportedLocale } from '@xnova/game-config';
import { requestLocaleOrNull } from '../common/request-locale';
import { ServerConfigService } from '../server-config/server-config.service';
import { SmtpConfigService } from './smtp-config.service';
import { renderMail, type MailKind, type MailParams } from './mail-templates';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  constructor(
    private readonly smtpConfig: SmtpConfigService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  /**
   * Langue d'un email : celle de la requête en cours quand l'utilisateur agit lui-même (`preferRequest`),
   * sinon la langue enregistrée sur son compte, à défaut la langue du serveur.
   */
  async resolveLocale(userLocale?: string | null, preferRequest = true): Promise<SupportedLocale> {
    const fromRequest = preferRequest ? requestLocaleOrNull() : null;
    if (fromRequest) return fromRequest;
    if (isSupportedLocale(userLocale)) return userLocale;
    return this.serverConfig.getLanguage();
  }

  /** Envoie un modèle d'email dans la langue du destinataire. */
  async sendTemplate(
    to: string,
    kind: MailKind,
    options: { locale?: SupportedLocale; userLocale?: string | null; preferRequest?: boolean; params?: MailParams } = {},
  ): Promise<void> {
    const locale = options.locale ?? (await this.resolveLocale(options.userLocale, options.preferRequest ?? true));
    await this.send({ to, ...renderMail(kind, locale, options.params) });
  }

  /** Vrai si l'envoi d'emails est activé et configuré (à vérifier avant d'émettre un jeton à envoyer). */
  async isConfigured(): Promise<boolean> {
    return (await this.smtpConfig.getForSending()) !== null;
  }

  /** Envoie un message avec la configuration SMTP courante ; échoue clairement si elle est absente. */
  async send(mail: OutgoingMail): Promise<void> {
    const config = await this.smtpConfig.getForSending();
    if (!config) {
      throw new ServiceUnavailableException("L'envoi d'emails n'est pas configuré");
    }

    const transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.username ? { user: config.username, pass: config.password ?? '' } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    try {
      await transport.sendMail({
        from: config.fromName ? `"${config.fromName.replace(/"/g, '')}" <${config.fromEmail}>` : config.fromEmail,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
    } finally {
      transport.close();
    }
  }
}
