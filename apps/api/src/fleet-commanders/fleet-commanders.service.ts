import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FLEET_COMMANDER_COST_DEUTERIUM,
  FLEET_COMMANDER_MAX_LEVEL,
  FLEET_COMMANDER_MAX_SKILL,
  MAX_FLEET_COMMANDERS,
  commanderBonuses,
  experienceForLevel,
  isCommanderSkill,
} from '@xnova/game-config';
import { debitResources, lockPlanet, lockUser } from '../common/atomic';
import { DatabaseService } from '../database/database.service';

/** Une flotte tient son commandant tant qu'elle n'est pas terminée (en vol, en maintien, au retour). */
const BUSY_FLEET = { status: { not: 'completed' } } as const;

@Injectable()
export class FleetCommandersService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string) {
    const commanders = await this.database.fleetCommander.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { fleets: { where: BUSY_FLEET, select: { id: true } } },
    });
    return {
      cost: FLEET_COMMANDER_COST_DEUTERIUM,
      max: MAX_FLEET_COMMANDERS,
      maxLevel: FLEET_COMMANDER_MAX_LEVEL,
      maxSkill: FLEET_COMMANDER_MAX_SKILL,
      commanders: commanders.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        experience: c.experience,
        levelStartExperience: experienceForLevel(c.level),
        nextLevelExperience: c.level >= FLEET_COMMANDER_MAX_LEVEL ? null : experienceForLevel(c.level + 1),
        skillPoints: c.skillPoints,
        skills: { attack: c.attack, defense: c.defense, speed: c.speed, cargo: c.cargo },
        bonuses: commanderBonuses(c),
        busy: c.fleets.length > 0,
      })),
    };
  }

  /** Recrute un commandant : prix en deutérium prélevé sur la planète choisie, limite par joueur. */
  async recruit(userId: string, name: string, planetId: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new BadRequestException('Nom trop court');
    const planet = await this.database.planet.findUnique({ where: { id: planetId }, select: { userId: true } });
    if (!planet || planet.userId !== userId) throw new NotFoundException('Planete introuvable');

    await this.database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const count = await tx.fleetCommander.count({ where: { userId } });
      if (count >= MAX_FLEET_COMMANDERS) {
        throw new BadRequestException(`Nombre maximal de commandants atteint (${MAX_FLEET_COMMANDERS})`);
      }
      await lockPlanet(tx, planetId);
      try {
        await debitResources(tx, planetId, { metal: 0, crystal: 0, deuterium: FLEET_COMMANDER_COST_DEUTERIUM });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(`Deuterium insuffisant : ${FLEET_COMMANDER_COST_DEUTERIUM} requis sur cette planete`);
        }
        throw error;
      }
      await tx.fleetCommander.create({ data: { userId, name: trimmed } });
    });
    return this.list(userId);
  }

  /** Dépense un point de compétence (atomique : jamais de point négatif ni de niveau au-delà de 10). */
  async spendPoint(userId: string, commanderId: string, skill: string) {
    if (!isCommanderSkill(skill)) throw new BadRequestException('Competence inconnue');
    const result = await this.database.fleetCommander.updateMany({
      where: { id: commanderId, userId, skillPoints: { gte: 1 }, [skill]: { lt: FLEET_COMMANDER_MAX_SKILL } },
      data: { skillPoints: { decrement: 1 }, [skill]: { increment: 1 } },
    });
    if (result.count !== 1) {
      const exists = await this.database.fleetCommander.findFirst({ where: { id: commanderId, userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Commandant introuvable');
      throw new BadRequestException('Aucun point disponible ou competence au maximum');
    }
    return this.list(userId);
  }

  /** Renvoie un commandant qui n'est pas en mission. */
  async dismiss(userId: string, commanderId: string) {
    await this.database.$transaction(async (tx) => {
      await this.lockCommander(tx, commanderId);
      const commander = await tx.fleetCommander.findFirst({
        where: { id: commanderId, userId },
        include: { fleets: { where: BUSY_FLEET, select: { id: true } } },
      });
      if (!commander) throw new NotFoundException('Commandant introuvable');
      if (commander.fleets.length > 0) throw new BadRequestException('Ce commandant est en mission');
      await tx.fleetCommander.delete({ where: { id: commanderId } });
    });
    return this.list(userId);
  }

  /** Bonus d'un commandant du joueur (lecture avant l'envoi : vitesse et capacité de cargaison). */
  async bonusesForSend(userId: string, commanderId: string | undefined) {
    if (!commanderId) return commanderBonuses(null);
    const commander = await this.database.fleetCommander.findFirst({
      where: { id: commanderId, userId },
      select: { attack: true, defense: true, speed: true, cargo: true },
    });
    if (!commander) throw new NotFoundException('Commandant introuvable');
    return commanderBonuses(commander);
  }

  /** Dans la transaction d'envoi : verrouille le commandant et vérifie qu'il est libre. */
  async assertAssignable(tx: Prisma.TransactionClient, userId: string, commanderId: string) {
    await this.lockCommander(tx, commanderId);
    const commander = await tx.fleetCommander.findFirst({
      where: { id: commanderId, userId },
      include: { fleets: { where: BUSY_FLEET, select: { id: true } } },
    });
    if (!commander) throw new NotFoundException('Commandant introuvable');
    if (commander.fleets.length > 0) throw new BadRequestException('Ce commandant est deja en mission');
  }

  private async lockCommander(tx: Prisma.TransactionClient, commanderId: string) {
    await tx.$queryRaw`SELECT "id" FROM "FleetCommander" WHERE "id" = ${commanderId} FOR UPDATE`;
  }
}
