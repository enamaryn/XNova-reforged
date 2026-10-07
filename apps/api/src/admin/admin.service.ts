import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BUILDINGS, TECHNOLOGIES } from '@xnova/game-config';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ServerConfigService } from '../server-config/server-config.service';
import { MailService } from '../mail/mail.service';
import { SmtpConfigService } from '../mail/smtp-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { UpdateSmtpDto } from './dto/update-smtp.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { UnbanUserDto } from './dto/unban-user.dto';
import { BoostDevelopmentDto } from './dto/boost-development.dto';
import { ListPlayersDto } from './dto/list-players.dto';
import { AccountService } from '../auth/account.service';
import { isBanned } from '../auth/ban.util';
import { ResourcesService } from '../resources/resources.service';
const BUILDING_FIELDS = [
  'metalMine',
  'crystalMine',
  'deuteriumMine',
  'solarPlant',
  'fusionPlant',
  'roboticsFactory',
  'naniteFactory',
  'shipyard',
  'metalStorage',
  'crystalStorage',
  'deuteriumStorage',
  'researchLab',
  'terraformer',
  'allianceDepot',
  'missileSilo',
  'moonBase',
  'phalanx',
  'jumpGate',
] as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEvents: GameEventsGateway,
    private readonly smtpConfig: SmtpConfigService,
    private readonly mail: MailService,
    private readonly account: AccountService,
    private readonly resources: ResourcesService,
  ) {}

  async getPlayers(dto: ListPlayersDto) {
    const pageSize = 25;
    const where = dto.search ? { username: { contains: dto.search, mode: 'insensitive' as const } } : {};
    const [total, users] = await Promise.all([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where, skip: (dto.page - 1) * pageSize, take: pageSize,
        orderBy: [{ username: 'asc' }, { id: 'asc' }],
        select: {
          id: true, username: true, email: true, emailVerifiedAt: true, role: true,
          points: true, rank: true, lastActive: true, bannedAt: true, bannedUntil: true,
          _count: { select: { planets: true } },
        },
      }),
    ]);
    return { total, page: dto.page, pageSize, players: users.map(({ _count, ...user }) => ({ ...user, planets: _count.planets, banned: isBanned(user) })) };
  }

  async getPlayer(id: string) {
    const user = await this.database.user.findUnique({
      where: { id }, include: { planets: { orderBy: [{ galaxy: 'asc' }, { system: 'asc' }, { position: 'asc' }] }, technologies: true },
    });
    if (!user) throw new NotFoundException('Joueur introuvable');
    const snapshots = await Promise.all(user.planets.map(planet => this.resources.getPlanetResources(planet.id, user.id)));
    const buildingIds = [1, 2, 3, 4, 12, 14, 15, 21, 22, 23, 24, 31, 33, 34, 44, 41, 42, 43];
    return {
      id: user.id, username: user.username, email: user.email, role: user.role,
      emailVerifiedAt: user.emailVerifiedAt, mustVerifyEmail: user.mustVerifyEmail,
      points: user.points, rank: user.rank, createdAt: user.createdAt, lastActive: user.lastActive,
      banned: isBanned(user), bannedUntil: user.bannedUntil, banReason: user.banReason,
      technologies: Object.values(TECHNOLOGIES).map(tech => ({ id: tech.id, name: tech.name, level: user.technologies.find(row => row.techId === tech.id)?.level || 0 })),
      planets: user.planets.map((planet, index) => ({
        id: planet.id, name: planet.name, coordinates: `${planet.galaxy}:${planet.system}:${planet.position}`,
        resources: snapshots[index].resources,
        energy: { produced: snapshots[index].energy.available, used: snapshots[index].energy.used },
        fields: { used: planet.fieldsUsed, max: planet.fieldsMax }, lastUpdate: snapshots[index].lastUpdate,
        buildings: BUILDING_FIELDS.map((field, index) => ({ id: buildingIds[index], name: BUILDINGS[buildingIds[index]].name, level: planet[field] })),
      })),
    };
  }

  updatePlayerEmail(actorId: string, targetId: string, email: string) {
    return this.account.adminChangeEmail(actorId, targetId, email);
  }

  async getConfig() {
    return this.serverConfig.getConfig();
  }

  async updateConfig(userId: string, dto: UpdateConfigDto) {
    return this.serverConfig.updateConfig(userId, dto);
  }

  getSmtpConfig() {
    return this.smtpConfig.getPublic();
  }

  async updateSmtpConfig(actorId: string, dto: UpdateSmtpDto) {
    const merged = { ...(await this.smtpConfig.getPublic()), ...dto };
    if (dto.enabled === true || (dto.enabled === undefined && merged.enabled)) {
      if (!merged.host || !merged.fromEmail) {
        throw new BadRequestException(
          "L'hôte et l'adresse d'expédition sont requis pour activer l'envoi d'emails",
        );
      }
    }

    const changed = await this.smtpConfig.update(dto);

    // Journal : noms des champs modifiés seulement, jamais le mot de passe
    if (changed.length > 0) {
      await this.database.adminAuditLog.create({
        data: { userId: actorId, action: 'update_smtp', changes: { fields: changed } },
      });
    }

    return this.smtpConfig.getPublic();
  }

  async sendSmtpTest(actorId: string, to?: string) {
    const actor = await this.database.user.findUnique({
      where: { id: actorId },
      select: { email: true },
    });
    const recipient = to ?? actor?.email;
    if (!recipient) {
      throw new BadRequestException('Aucune adresse de destination');
    }

    try {
      await this.mail.send({
        to: recipient,
        subject: 'XNova Reforged - test de la configuration SMTP',
        text: "Si vous lisez ce message, la configuration SMTP fonctionne.",
      });
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      // Message technique du serveur SMTP : utile à l'administrateur, sans secret
      throw new BadRequestException(
        `Échec de l'envoi : ${(error as Error)?.message ?? 'erreur inconnue'}`,
      );
    }

    await this.database.adminAuditLog.create({
      data: { userId: actorId, action: 'test_smtp', changes: { to: recipient } },
    });
    return { success: true, to: recipient };
  }

  async updateUserRole(actorId: string, dto: UpdateRoleDto) {
    const user = await this.database.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (user.role === dto.role) {
      return { id: user.id, username: user.username, role: user.role };
    }

    const updated = await this.database.user.update({
      where: { id: user.id },
      data: { role: dto.role },
      select: { id: true, username: true, role: true },
    });

    await this.database.adminAuditLog.create({
      data: {
        userId: actorId,
        action: 'update_role',
        changes: {
          targetId: user.id,
          targetUsername: user.username,
          before: user.role,
          after: dto.role,
        },
      },
    });

    return updated;
  }

  async boostUserDevelopment(actorId: string, dto: BoostDevelopmentDto) {
    const target = await this.database.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true },
    });

    if (!target) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const { maxBuildingLevel, maxTechnologyLevel } = await this.serverConfig.getConfig();

    const planets = await this.database.planet.findMany({
      where: { userId: target.id },
      select: { id: true, fieldsMax: true },
    });

    const planetIds = planets.map((planet) => planet.id);
    const planetUpdates = planets.map((planet) =>
      this.database.planet.update({
        where: { id: planet.id },
        data: {
          ...this.buildMaxDevelopmentData(maxBuildingLevel),
          fieldsUsed: planet.fieldsMax,
        },
      }),
    );

    const techIds = Object.values(TECHNOLOGIES).map((tech) => tech.id);
    const techUpserts = techIds.map((techId) =>
      this.database.technology.upsert({
        where: { userId_techId: { userId: target.id, techId } },
        update: { level: maxTechnologyLevel },
        create: { userId: target.id, techId, level: maxTechnologyLevel },
      }),
    );

    const transactions = [
      ...(planetIds.length
        ? [
            this.database.buildQueue.deleteMany({
              where: { planetId: { in: planetIds }, completed: false },
            }),
          ]
        : []),
      this.database.researchQueue.deleteMany({
        where: { userId: target.id, completed: false },
      }),
      ...planetUpdates,
      ...techUpserts,
      this.database.adminAuditLog.create({
        data: {
          userId: actorId,
          action: 'boost_development',
          changes: {
            targetId: target.id,
            targetUsername: target.username,
            buildingLevel: maxBuildingLevel,
            technologyLevel: maxTechnologyLevel,
            planets: planets.length,
            technologies: techIds.length,
          },
        },
      }),
    ];

    await this.database.$transaction(transactions);

    return {
      success: true,
      username: target.username,
      buildingLevel: maxBuildingLevel,
      technologyLevel: maxTechnologyLevel,
      planetsUpdated: planets.length,
      technologiesUpdated: techIds.length,
    };
  }

  private buildMaxDevelopmentData(maxLevel: number) {
    return BUILDING_FIELDS.reduce<Record<string, number>>((acc, field) => {
      acc[field] = maxLevel;
      return acc;
    }, {});
  }

  async banUser(actorId: string, dto: BanUserDto) {
    const target = await this.database.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true, bannedUntil: true },
    });

    if (!target) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const durationMinutes =
      (dto.days ?? 0) * 24 * 60 + (dto.hours ?? 0) * 60 + (dto.minutes ?? 0);

    if (durationMinutes < 0) {
      throw new BadRequestException('Duree invalide');
    }

    const expiresAt = durationMinutes > 0 ? new Date(Date.now() + durationMinutes * 60000) : null;
    const now = new Date();

    await this.database.$transaction([
      this.database.user.update({
        where: { id: target.id },
        data: {
          bannedUntil: expiresAt,
          banReason: dto.reason?.trim() || null,
          bannedAt: now,
        },
      }),
      this.database.userBanLog.create({
        data: {
          userId: target.id,
          actorId,
          action: 'ban',
          reason: dto.reason?.trim() || null,
          expiresAt,
        },
      }),
      // SEC-03 : les sessions existantes (HTTP, refresh) sont révoquées immédiatement
      this.database.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.adminAuditLog.create({
        data: {
          userId: actorId,
          action: 'ban_user',
          changes: {
            targetId: target.id,
            targetUsername: target.username,
            expiresAt,
            reason: dto.reason?.trim() || null,
          },
        },
      }),
    ]);

    // ... et les sockets déjà ouverts sont coupés
    this.gameEvents.disconnectUser(target.id);

    return { success: true, expiresAt };
  }

  async unbanUser(actorId: string, dto: UnbanUserDto) {
    const target = await this.database.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true },
    });

    if (!target) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    await this.database.$transaction([
      this.database.user.update({
        where: { id: target.id },
        data: {
          bannedUntil: null,
          banReason: null,
          bannedAt: null,
        },
      }),
      this.database.userBanLog.create({
        data: {
          userId: target.id,
          actorId,
          action: 'unban',
          reason: dto.reason?.trim() || null,
        },
      }),
      this.database.adminAuditLog.create({
        data: {
          userId: actorId,
          action: 'unban_user',
          changes: {
            targetId: target.id,
            targetUsername: target.username,
            reason: dto.reason?.trim() || null,
          },
        },
      }),
    ]);

    return { success: true };
  }

  async getAuditLogs(limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return this.database.adminAuditLog.findMany({
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        changes: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async getBanLogs(limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return this.database.userBanLog.findMany({
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        actor: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async getOverview() {
    const onlineLimit = new Date(Date.now() - 15 * 60 * 1000);

    const [players, alliances, planets, onlinePlayers] = await Promise.all([
      this.database.user.count(),
      this.database.alliance.count(),
      this.database.planet.count(),
      this.database.user.count({ where: { lastActive: { gte: onlineLimit } } }),
    ]);

    return {
      players,
      alliances,
      planets,
      onlinePlayers,
      serverTime: new Date(),
    };
  }
}
