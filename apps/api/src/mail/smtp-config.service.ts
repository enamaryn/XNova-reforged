import { Injectable } from '@nestjs/common';
import { decryptSecret, encryptSecret } from '../common/security/secret-box';
import { DatabaseService } from '../database/database.service';

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
}

/** Configuration exposée à l'interface : jamais le mot de passe, seulement sa présence. */
export interface SmtpPublicSettings extends SmtpSettings {
  passwordSet: boolean;
  /** Vrai si un mot de passe est enregistré mais illisible (clé de chiffrement changée). */
  passwordUnreadable: boolean;
}

export interface SmtpUpdate {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  fromEmail?: string;
  fromName?: string;
  /** Absent : conservé. Chaîne non vide : remplacé. */
  password?: string;
  clearPassword?: boolean;
}

const KEY = (name: string) => `smtp.${name}`;
const FIELDS = ['enabled', 'host', 'port', 'secure', 'username', 'fromEmail', 'fromName'] as const;

const DEFAULTS: SmtpSettings = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  fromEmail: '',
  fromName: 'XNova Reforged',
};

@Injectable()
export class SmtpConfigService {
  constructor(private readonly database: DatabaseService) {}

  private async readAll(): Promise<Record<string, { value: string; updatedAt?: Date }>> {
    const rows = await this.database.gameConfig.findMany({
      where: { key: { startsWith: 'smtp.' } },
    });
    return Object.fromEntries(rows.map((row) => [row.key, { value: row.value }]));
  }

  private parse(rows: Record<string, { value: string }>): SmtpSettings {
    const read = (name: string) => rows[KEY(name)]?.value;
    const port = Number(read('port'));
    return {
      enabled: read('enabled') === 'true',
      host: read('host') ?? DEFAULTS.host,
      port: Number.isInteger(port) && port > 0 ? port : DEFAULTS.port,
      secure: read('secure') === 'true',
      username: read('username') ?? DEFAULTS.username,
      fromEmail: read('fromEmail') ?? DEFAULTS.fromEmail,
      fromName: read('fromName') ?? DEFAULTS.fromName,
    };
  }

  async getPublic(): Promise<SmtpPublicSettings> {
    const rows = await this.readAll();
    const stored = rows[KEY('password')]?.value;
    const password = decryptSecret(stored);
    return {
      ...this.parse(rows),
      passwordSet: !!stored && password !== null,
      passwordUnreadable: !!stored && password === null,
    };
  }

  /** Configuration complète pour l'envoi (mot de passe en clair, usage interne uniquement). */
  async getForSending(): Promise<(SmtpSettings & { password: string | null }) | null> {
    const rows = await this.readAll();
    const settings = this.parse(rows);
    if (!settings.enabled || !settings.host || !settings.fromEmail) return null;
    return { ...settings, password: decryptSecret(rows[KEY('password')]?.value) };
  }

  /** Enregistre les champs fournis ; retourne la liste des champs modifiés (sans valeurs). */
  async update(changes: SmtpUpdate): Promise<string[]> {
    const before = await this.getPublic();
    const changed: string[] = [];
    const writes: Array<{ key: string; value: string }> = [];

    for (const field of FIELDS) {
      const next = changes[field];
      if (next === undefined) continue;
      if (next !== before[field]) changed.push(field);
      writes.push({ key: KEY(field), value: String(next) });
    }

    if (changes.password) {
      writes.push({ key: KEY('password'), value: encryptSecret(changes.password) });
      changed.push('password');
    } else if (changes.clearPassword) {
      await this.database.gameConfig.deleteMany({ where: { key: KEY('password') } });
      if (before.passwordSet || before.passwordUnreadable) changed.push('password');
    }

    await this.database.$transaction(
      writes.map((write) =>
        this.database.gameConfig.upsert({
          where: { key: write.key },
          update: { value: write.value },
          create: write,
        }),
      ),
    );

    return changed;
  }
}
