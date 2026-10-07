import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import {
  SetupDb,
  clearSetupArtifacts,
  formatSetupBanner,
  isSetupCompleted,
  issueSetupToken,
  markSetupCompleted,
  readProgressFlags,
} from './setup-core';

/**
 * État de l'installation du serveur (SETUP-01) : indicateur de fin, code d'installation, clôture.
 * Module léger, importé par l'authentification (inscription fermée tant que l'installation n'est pas
 * terminée, clôture à la confirmation de l'adresse du super admin) sans dépendre du parcours lui-même.
 */
@Injectable()
export class SetupStateService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Setup');

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  private get db(): SetupDb {
    return this.database as unknown as SetupDb;
  }

  isCompleted(): Promise<boolean> {
    return isSetupCompleted(this.db);
  }

  /** Au démarrage : installation terminée → plus aucun code ; sinon un nouveau code est affiché dans le terminal. */
  async onApplicationBootstrap() {
    if (await this.isCompleted()) {
      await clearSetupArtifacts(this.db);
      return;
    }
    const fixed = this.config.get<string>('SETUP_TOKEN')?.trim();
    const token = await issueSetupToken(this.db, { fixedToken: fixed });
    if (fixed) {
      this.logger.warn("Installation du serveur en attente : code d'installation fixé par SETUP_TOKEN (automatisation).");
    } else {
      // console.log : visible dans `journalctl -u xnova-api`, sans dépendre du niveau de journalisation
      console.log(formatSetupBanner(token));
    }
  }

  /**
   * Appelé après la confirmation d'une adresse : si c'est celle du super admin créé par le parcours, l'installation
   * est terminée (indicateur posé, code effacé, le parcours web disparaît).
   */
  async completeIfReady(userId: string): Promise<boolean> {
    if (await this.isCompleted()) return false;
    const { adminId } = await readProgressFlags(this.db);
    if (!adminId || adminId !== userId) return false;

    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerifiedAt: true, role: true },
    });
    if (!user?.emailVerifiedAt || user.role !== 'SUPER_ADMIN') return false;

    await markSetupCompleted(this.db);
    await this.database.adminAuditLog.create({
      data: { userId, action: 'setup_complete', changes: { by: 'setup-wizard' } },
    });
    this.logger.log('Installation du serveur terminée : le parcours est verrouillé.');
    return true;
  }
}
