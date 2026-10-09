import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  BUILDINGS,
  TECHNOLOGIES,
  SHIPS,
  DEFENSES,
  GAME_CONSTANTS,
} from "@xnova/game-config";
import type { Prisma } from "@prisma/client";
import { ManagePlayerDto } from "./dto/manage-player.dto";
import { DatabaseService } from "../database/database.service";
import { GameEventsGateway } from "../game-events/game-events.gateway";
import { ServerConfigService } from "../server-config/server-config.service";
import { MailService } from "../mail/mail.service";
import { SmtpConfigService } from "../mail/smtp-config.service";
import { UpdateConfigDto } from "./dto/update-config.dto";
import { UpdateSmtpDto } from "./dto/update-smtp.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { BanUserDto } from "./dto/ban-user.dto";
import { UnbanUserDto } from "./dto/unban-user.dto";
import { BoostDevelopmentDto } from "./dto/boost-development.dto";
import { ListPlayersDto } from "./dto/list-players.dto";
import { AccountService } from "../auth/account.service";
import { isBanned } from "../auth/ban.util";
import { ResourcesService } from "../resources/resources.service";
const BUILDING_FIELDS = [
  "metalMine",
  "crystalMine",
  "deuteriumMine",
  "solarPlant",
  "fusionPlant",
  "roboticsFactory",
  "naniteFactory",
  "shipyard",
  "metalStorage",
  "crystalStorage",
  "deuteriumStorage",
  "researchLab",
  "terraformer",
  "allianceDepot",
  "missileSilo",
  "moonBase",
  "phalanx",
  "jumpGate",
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
    const where = dto.search
      ? { username: { contains: dto.search, mode: "insensitive" as const } }
      : {};
    const [total, users] = await Promise.all([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where,
        skip: (dto.page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ username: "asc" }, { id: "asc" }],
        select: {
          id: true,
          username: true,
          email: true,
          emailVerifiedAt: true,
          role: true,
          points: true,
          rank: true,
          lastActive: true,
          bannedAt: true,
          bannedUntil: true,
          _count: { select: { planets: true } },
        },
      }),
    ]);
    return {
      total,
      page: dto.page,
      pageSize,
      players: users.map(({ _count, ...user }) => ({
        ...user,
        planets: _count.planets,
        banned: isBanned(user),
      })),
    };
  }

  async getPlayer(id: string) {
    const user = await this.database.user.findUnique({
      where: { id },
      include: {
        planets: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            ships: true,
            defenses: true,
            buildQueue: { where: { completed: false } },
            shipQueue: { where: { completed: false } },
          },
        },
        technologies: true,
        fleets: {
          where: { status: { not: "completed" } },
          orderBy: { startTime: "asc" },
        },
      },
    });
    if (!user) throw new NotFoundException("Joueur introuvable");
    const snapshots = await Promise.all(
      user.planets.map((planet) =>
        this.resources.getPlanetResources(planet.id, user.id),
      ),
    );
    const researchQueue = await this.database.researchQueue.findMany({
      where: { userId: id, completed: false },
      orderBy: { endTime: "asc" },
    });
    const incomingFleets = user.planets.length
      ? await this.database.fleet.findMany({
          where: {
            userId: { not: id },
            status: { not: "completed" },
            OR: user.planets.map((planet) => ({
              toGalaxy: planet.galaxy,
              toSystem: planet.system,
              toPosition: planet.position,
            })),
          },
          orderBy: { arrivalTime: "asc" },
        })
      : [];
    const buildingIds = [
      1, 2, 3, 4, 12, 14, 15, 21, 22, 23, 24, 31, 33, 34, 44, 41, 42, 43,
    ];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      mustVerifyEmail: user.mustVerifyEmail,
      points: user.points,
      rank: user.rank,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      banned: isBanned(user),
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      fleets: user.fleets,
      incomingFleets,
      researchQueue: researchQueue.map((row) => ({
        ...row,
        name: TECHNOLOGIES[row.techId]?.name ?? `Technologie ${row.techId}`,
      })),
      technologies: Object.values(TECHNOLOGIES).map((tech) => ({
        id: tech.id,
        name: tech.name,
        level:
          user.technologies.find((row) => row.techId === tech.id)?.level || 0,
      })),
      planets: user.planets.map((planet, index) => ({
        id: planet.id,
        name: planet.name,
        planetType: planet.planetType,
        coordinates: `${planet.galaxy}:${planet.system}:${planet.position}`,
        resources: snapshots[index].resources,
        energy: {
          produced: snapshots[index].energy.available,
          used: snapshots[index].energy.used,
        },
        fields: { used: planet.fieldsUsed, max: planet.fieldsMax },
        lastUpdate: snapshots[index].lastUpdate,
        ships: planet.ships
          .filter((row) => row.amount > 0)
          .map((row) => ({
            id: row.shipId,
            name: SHIPS[row.shipId]?.name ?? `Vaisseau ${row.shipId}`,
            amount: row.amount,
          })),
        defenses: planet.defenses
          .filter((row) => row.amount > 0)
          .map((row) => ({
            id: row.defenseId,
            name: DEFENSES[row.defenseId]?.name ?? `Défense ${row.defenseId}`,
            amount: row.amount,
          })),
        buildQueue: planet.buildQueue
          .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
          .map((row) => ({
            ...row,
            name:
              BUILDINGS[row.buildingId]?.name ?? `Bâtiment ${row.buildingId}`,
          })),
        shipQueue: planet.shipQueue
          .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
          .map((row) => ({
            ...row,
            name:
              SHIPS[row.shipId]?.name ??
              DEFENSES[row.shipId]?.name ??
              `Unité ${row.shipId}`,
          })),
        buildings: BUILDING_FIELDS.map((field, index) => ({
          id: buildingIds[index],
          name: BUILDINGS[buildingIds[index]].name,
          level: planet[field],
        })),
      })),
    };
  }

  private async assertPlayerManagement(
    client: Pick<Prisma.TransactionClient, "user">,
    actorId: string,
    target: { id: string; role: string },
  ) {
    const actor = await client.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    const ranks: Record<string, number> = {
      PLAYER: 0,
      MODERATOR: 1,
      ADMIN: 2,
      SUPER_ADMIN: 3,
    };
    if (
      !actor ||
      target.id === actorId ||
      (ranks[actor.role] ?? 0) <= (ranks[target.role] ?? 0)
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez pas gérer votre propre compte ni un compte de rang égal ou supérieur",
      );
    }
  }

  async managePlayer(
    actorId: string,
    targetId: string,
    dto: ManagePlayerDto,
    action: "reset" | "delete",
  ) {
    const config =
      action === "reset" ? await this.serverConfig.getConfig() : null;
    try {
      const result = await this.database.$transaction(
        async (tx) => {
          // Rare, short administrative transaction. Quiesce writes so an incoming fleet,
          // colony or queue completion cannot race with destructive account management.
          await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
          await tx.$executeRaw`LOCK TABLE "User", "Planet", "Fleet", "Technology", "BuildQueue", "ResearchQueue", "ShipQueue", "Ship", "Defense", "Alliance", "AllianceMember", "AdminAuditLog" IN SHARE ROW EXCLUSIVE MODE`;
          const target = await tx.user.findUnique({
            where: { id: targetId },
            include: {
              planets: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            },
          });
          if (!target) throw new NotFoundException("Joueur introuvable");
          await this.assertPlayerManagement(tx, actorId, target);
          if (
            dto.confirmationUsername !== target.username ||
            dto.reason.trim().length < 3
          )
            throw new BadRequestException(
              "Confirmez le pseudo exact et indiquez un motif",
            );
          const activeFleet = await tx.fleet.findFirst({
            where: {
              status: { not: "completed" },
              OR: [
                { userId: targetId },
                ...target.planets.map((planet) => ({
                  toGalaxy: planet.galaxy,
                  toSystem: planet.system,
                  toPosition: planet.position,
                })),
              ],
            },
          });
          if (activeFleet)
            throw new ConflictException(
              "Une flotte active appartient à ce joueur ou se dirige vers une de ses planètes. Attendez sa fin ou rappelez-la avant cette action.",
            );
          const alliance = await tx.alliance.findFirst({
            where: { founderId: targetId },
          });
          if (action === "delete" && alliance)
            throw new ConflictException(
              "Ce joueur fonde une alliance : transférez sa fondation ou dissolvez-la avant cette action.",
            );
          const planetIds = target.planets.map((planet) => planet.id);
          const archivedAdminLogs =
            action === "delete"
              ? await tx.adminAuditLog.findMany({
                  where: { userId: targetId },
                  orderBy: { createdAt: "asc" },
                  select: { action: true, changes: true, createdAt: true },
                })
              : [];
          if (action === "reset") {
            const home = target.planets[0];
            if (!home)
              throw new ConflictException(
                "Ce compte ne possède pas de planète à réinitialiser",
              );
            await tx.buildQueue.deleteMany({
              where: { planetId: { in: planetIds } },
            });
            await tx.researchQueue.deleteMany({ where: { userId: targetId } });
            await tx.shipQueue.deleteMany({
              where: { planetId: { in: planetIds } },
            });
            await tx.ship.deleteMany({
              where: { planetId: { in: planetIds } },
            });
            await tx.defense.deleteMany({
              where: { planetId: { in: planetIds } },
            });
            await tx.technology.deleteMany({ where: { userId: targetId } });
            await tx.fleet.deleteMany({ where: { userId: targetId } });
            await tx.planet.deleteMany({
              where: { userId: targetId, id: { not: home.id } },
            });
            await tx.planet.update({
              where: { id: home.id },
              data: {
                ...this.buildMaxDevelopmentData(0),
                name: "Planète Mère",
                planetType: "normal",
                fieldsUsed: 0,
                fieldsMax: config!.planetSize,
                metal: GAME_CONSTANTS.STARTING_METAL,
                crystal: GAME_CONSTANTS.STARTING_CRYSTAL,
                deuterium: GAME_CONSTANTS.STARTING_DEUTERIUM,
                metalProduction: 0,
                crystalProduction: 0,
                deuteriumProduction: 0,
                energyUsed: 0,
                energyAvailable: 0,
                lastUpdate: new Date(),
              },
            });
            await tx.user.update({
              where: { id: targetId },
              data: { points: 0, rank: 0 },
            });
            await tx.session.updateMany({
              where: { userId: targetId, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          } else {
            // ResearchQueue.userId and combat report participant IDs are not foreign keys.
            await tx.researchQueue.deleteMany({ where: { userId: targetId } });
            await tx.combatReport.deleteMany({
              where: {
                OR: [{ attackerId: targetId }, { defenderId: targetId }],
              },
            });
            await tx.user.delete({ where: { id: targetId } });
          }
          await tx.adminAuditLog.create({
            data: {
              userId: actorId,
              action: `${action}_player`,
              changes: {
                targetId,
                targetUsername: target.username,
                reason: dto.reason.trim(),
                planets: planetIds.length,
                ...(action === "delete"
                  ? {
                      archivedAdminLogs: archivedAdminLogs.map((row) => ({
                        action: row.action,
                        changes: row.changes,
                        createdAt: row.createdAt.toISOString(),
                      })),
                    }
                  : {}),
              },
            },
          });
          return { success: true, username: target.username };
        },
        { timeout: 15000 },
      );
      this.gameEvents.disconnectUser(targetId);
      return result;
    } catch (error) {
      if (
        (error as { code?: string }).code === "P2034" ||
        ["40P01", "55P03"].includes(
          (error as { meta?: { code?: string } }).meta?.code ?? "",
        )
      )
        throw new ConflictException(
          "Une action concurrente a été détectée : réessayez",
        );
      throw error;
    }
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
        data: {
          userId: actorId,
          action: "update_smtp",
          changes: { fields: changed },
        },
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
      throw new BadRequestException("Aucune adresse de destination");
    }

    try {
      await this.mail.send({
        to: recipient,
        subject: "XNova Reforged - test de la configuration SMTP",
        text: "Si vous lisez ce message, la configuration SMTP fonctionne.",
      });
    } catch (error) {
      if (error instanceof Error && "getStatus" in error) throw error;
      // Message technique du serveur SMTP : utile à l'administrateur, sans secret
      throw new BadRequestException(
        `Échec de l'envoi : ${(error as Error)?.message ?? "erreur inconnue"}`,
      );
    }

    await this.database.adminAuditLog.create({
      data: {
        userId: actorId,
        action: "test_smtp",
        changes: { to: recipient },
      },
    });
    return { success: true, to: recipient };
  }

  async updateUserRole(actorId: string, dto: UpdateRoleDto) {
    const user = await this.database.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true, role: true },
    });

    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
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
        action: "update_role",
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
      throw new NotFoundException("Utilisateur introuvable");
    }

    const { maxBuildingLevel, maxTechnologyLevel } =
      await this.serverConfig.getConfig();

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
          action: "boost_development",
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
      select: { id: true, username: true, bannedUntil: true, role: true },
    });

    if (!target) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    await this.assertPlayerManagement(this.database, actorId, target);
    const durationMinutes =
      (dto.days ?? 0) * 24 * 60 + (dto.hours ?? 0) * 60 + (dto.minutes ?? 0);

    if (durationMinutes < 0) {
      throw new BadRequestException("Duree invalide");
    }

    const expiresAt =
      durationMinutes > 0
        ? new Date(Date.now() + durationMinutes * 60000)
        : null;
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
          action: "ban",
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
          action: "ban_user",
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
      select: { id: true, username: true, role: true },
    });

    if (!target) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    await this.assertPlayerManagement(this.database, actorId, target);
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
          action: "unban",
          reason: dto.reason?.trim() || null,
        },
      }),
      this.database.adminAuditLog.create({
        data: {
          userId: actorId,
          action: "unban_user",
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
      orderBy: { createdAt: "desc" },
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
      orderBy: { createdAt: "desc" },
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
