import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { SmtpConfigService } from './smtp-config.service';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  constructor(private readonly smtpConfig: SmtpConfigService) {}

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
