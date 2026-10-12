import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ANTI_BALLISTIC_MISSILE_ID,
  INTERPLANETARY_MISSILE_ID,
  MISSILE_ARMOR_TECH_ID,
  MISSILE_IDS,
  MISSILE_RANGE_TECH_ID,
  MISSILE_TARGET_ORDER,
  MISSILE_WEAPON_TECH_ID,
  MISSILE_DAMAGE,
  missileCapacity,
  missileFlightSeconds,
  missileRange,
} from '@xnova/game-config';
import { resolveMissileStrike } from '@xnova/game-engine';
import { lockPlanet } from '../common/atomic';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ServerConfigService } from '../server-config/server-config.service';
import { LaunchMissilesDto } from './dto/launch-missiles.dto';

/** Nombre de frappes récentes renvoyées pour chaque sens (lancées / subies). */
const HISTORY_LIMIT = 20;

@Injectable()
export class MissilesService {
  private readonly logger = new Logger(MissilesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  private async ownedPlanet(planetId: string, userId: string) {
    const planet = await this.database.planet.findUnique({ where: { id: planetId } });
    if (!planet) throw new NotFoundException('Planete introuvable');
    if (planet.userId !== userId) throw new ForbiddenException('Acces refuse');
    return planet;
  }

  private async techLevels(userId: string, techIds: number[]) {
    const rows = await this.database.technology.findMany({
      where: { userId, techId: { in: techIds } },
      select: { techId: true, level: true },
    });
    return new Map(rows.map((row) => [row.techId, row.level]));
  }

  /** Silo, stock, portée et frappes de la planète : de quoi afficher le panneau de lancement. */
  async overview(planetId: string, userId: string) {
    const planet = await this.ownedPlanet(planetId, userId);
    const [stock, queued, tech, outgoing, incoming] = await Promise.all([
      this.database.defense.findMany({
        where: { planetId, defenseId: { in: [...MISSILE_IDS] } },
        select: { defenseId: true, amount: true },
      }),
      this.database.shipQueue.findMany({
        where: { planetId, completed: false, shipId: { in: [...MISSILE_IDS] } },
        select: { amount: true },
      }),
      this.techLevels(userId, [MISSILE_RANGE_TECH_ID]),
      this.database.missileStrike.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
      this.database.missileStrike.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
    ]);
    const amounts = new Map(stock.map((row) => [row.defenseId, row.amount]));
    const inQueue = queued.reduce((sum, entry) => sum + entry.amount, 0);
    const interplanetary = amounts.get(INTERPLANETARY_MISSILE_ID) ?? 0;
    const interception = amounts.get(ANTI_BALLISTIC_MISSILE_ID) ?? 0;
    const impulse = tech.get(MISSILE_RANGE_TECH_ID) ?? 0;

    return {
      planetId,
      silo: {
        level: planet.missileSilo,
        capacity: missileCapacity(planet.missileSilo),
        stored: interplanetary + interception,
        inQueue,
      },
      interplanetary,
      interception,
      range: missileRange(impulse),
      galaxy: planet.galaxy,
      system: planet.system,
      targets: MISSILE_TARGET_ORDER,
      outgoing: outgoing.map((strike) => this.present(strike, true)),
      // Le défenseur voit l'arrivée imminente mais pas le détail d'une frappe non résolue.
      incoming: incoming.map((strike) => this.present(strike, false)),
    };
  }

  private present(
    strike: {
      id: string;
      fromGalaxy: number;
      fromSystem: number;
      fromPosition: number;
      toGalaxy: number;
      toSystem: number;
      toPosition: number;
      missiles: number;
      primaryTarget: number | null;
      startTime: Date;
      arrivalTime: Date;
      status: string;
      result: unknown;
    },
    owner: boolean,
  ) {
    return {
      id: strike.id,
      from: { galaxy: strike.fromGalaxy, system: strike.fromSystem, position: strike.fromPosition },
      to: { galaxy: strike.toGalaxy, system: strike.toSystem, position: strike.toPosition },
      missiles: strike.missiles,
      primaryTarget: owner ? strike.primaryTarget : null,
      startTime: strike.startTime,
      arrivalTime: strike.arrivalTime,
      status: strike.status,
      result: strike.status === 'resolved' ? strike.result : null,
    };
  }

  async launch(dto: LaunchMissilesDto, userId: string) {
    const planet = await this.ownedPlanet(dto.planetId, userId);

    if (planet.galaxy !== dto.toGalaxy) {
      throw new BadRequestException('Les missiles ne traversent pas les galaxies');
    }
    const tech = await this.techLevels(userId, [MISSILE_RANGE_TECH_ID]);
    const range = missileRange(tech.get(MISSILE_RANGE_TECH_ID) ?? 0);
    const systemDistance = Math.abs(planet.system - dto.toSystem);
    if (systemDistance > range) {
      throw new BadRequestException('Cible hors de portee de vos missiles');
    }

    const target = await this.database.planet.findUnique({
      where: {
        galaxy_system_position_isMoon: {
          galaxy: dto.toGalaxy,
          system: dto.toSystem,
          position: dto.toPosition,
          isMoon: false,
        },
      },
      select: { userId: true },
    });
    if (!target) throw new BadRequestException('Aucune planete a cette position');
    if (target.userId === userId) {
      throw new BadRequestException('Vous ne pouvez pas viser votre propre planete');
    }

    const { fleetSpeed } = await this.serverConfig.getConfig();
    const duration = Math.max(1, Math.floor(missileFlightSeconds(systemDistance) / fleetSpeed));
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + duration * 1000);

    const strike = await this.database.$transaction(async (tx) => {
      await lockPlanet(tx, dto.planetId);
      const debited = await tx.defense.updateMany({
        where: {
          planetId: dto.planetId,
          defenseId: INTERPLANETARY_MISSILE_ID,
          amount: { gte: dto.amount },
        },
        data: { amount: { decrement: dto.amount } },
      });
      if (debited.count !== 1) {
        throw new BadRequestException('Missiles interplanetaires insuffisants');
      }
      return tx.missileStrike.create({
        data: {
          userId,
          targetUserId: target.userId,
          fromGalaxy: planet.galaxy,
          fromSystem: planet.system,
          fromPosition: planet.position,
          toGalaxy: dto.toGalaxy,
          toSystem: dto.toSystem,
          toPosition: dto.toPosition,
          missiles: dto.amount,
          primaryTarget: dto.primaryTarget ?? null,
          startTime: now,
          arrivalTime,
        },
      });
    });

    this.gameEvents.emitToUser(target.userId, 'missiles:incoming', {
      strikeId: strike.id,
      arrivalTime,
    });

    return { success: true, strikeId: strike.id, durationSeconds: duration, arrivalTime };
  }

  /** Résout les frappes arrivées. Appelée par la tâche planifiée ; chaque frappe n'est traitée qu'une fois. */
  async resolveDue(): Promise<number> {
    const due = await this.database.missileStrike.findMany({
      where: { status: 'traveling', arrivalTime: { lte: new Date() } },
      orderBy: { arrivalTime: 'asc' },
      take: 200,
    });
    let resolved = 0;
    for (const strike of due) {
      try {
        if (await this.resolveStrike(strike.id)) resolved += 1;
      } catch (error) {
        this.logger.error(`Resolution de la frappe ${strike.id} impossible`, error as Error);
      }
    }
    return resolved;
  }

  private async resolveStrike(strikeId: string): Promise<boolean> {
    const outcome = await this.database.$transaction(async (tx) => {
      // Prise en charge atomique : un seul traitement par frappe
      const claimed = await tx.missileStrike.updateMany({
        where: { id: strikeId, status: 'traveling' },
        data: { status: 'resolved' },
      });
      if (claimed.count !== 1) return null;
      const strike = await tx.missileStrike.findUniqueOrThrow({ where: { id: strikeId } });

      const target = await tx.planet.findUnique({
        where: {
          galaxy_system_position_isMoon: {
            galaxy: strike.toGalaxy,
            system: strike.toSystem,
            position: strike.toPosition,
            isMoon: false,
          },
        },
        select: { id: true, userId: true },
      });

      let result: Record<string, unknown>;
      if (!target || target.userId !== strike.targetUserId) {
        // La planète n'existe plus ou a changé de propriétaire : les missiles se perdent.
        result = { launched: strike.missiles, intercepted: 0, hits: 0, destroyed: {}, lost: true };
      } else {
        await lockPlanet(tx, target.id);
        const [defenseRows, attackerTech, defenderTech] = await Promise.all([
          tx.defense.findMany({
            where: { planetId: target.id, amount: { gt: 0 } },
            select: { defenseId: true, amount: true },
          }),
          tx.technology.findFirst({
            where: { userId: strike.userId, techId: MISSILE_WEAPON_TECH_ID },
            select: { level: true },
          }),
          tx.technology.findFirst({
            where: { userId: strike.targetUserId, techId: MISSILE_ARMOR_TECH_ID },
            select: { level: true },
          }),
        ]);
        const defenses: Record<number, number> = {};
        for (const row of defenseRows) defenses[row.defenseId] = row.amount;

        const strikeResult = resolveMissileStrike({
          missiles: strike.missiles,
          antiBallistic: defenses[ANTI_BALLISTIC_MISSILE_ID] ?? 0,
          defenses,
          attackerWeapon: attackerTech?.level ?? 0,
          defenderArmor: defenderTech?.level ?? 0,
          primaryTarget: strike.primaryTarget,
        });

        // Décrémentation bornée : une construction ou un tir concurrent ne doit jamais rendre le stock négatif
        if (strikeResult.antiBallisticUsed > 0) {
          await tx.defense.updateMany({
            where: {
              planetId: target.id,
              defenseId: ANTI_BALLISTIC_MISSILE_ID,
              amount: { gte: strikeResult.antiBallisticUsed },
            },
            data: { amount: { decrement: strikeResult.antiBallisticUsed } },
          });
        }
        for (const [defenseId, count] of Object.entries(strikeResult.destroyed)) {
          await tx.defense.updateMany({
            where: { planetId: target.id, defenseId: Number(defenseId), amount: { gte: count } },
            data: { amount: { decrement: count } },
          });
        }
        result = {
          launched: strikeResult.launched,
          intercepted: strikeResult.intercepted,
          hits: strikeResult.hits,
          destroyed: strikeResult.destroyed,
          damagePerMissile: MISSILE_DAMAGE * (1 + 0.1 * (attackerTech?.level ?? 0)),
        };
      }

      await tx.missileStrike.update({
        where: { id: strikeId },
        data: { result: result as object },
      });
      return { strike, result };
    });

    if (!outcome) return false;
    for (const userId of [outcome.strike.userId, outcome.strike.targetUserId]) {
      this.gameEvents.emitToUser(userId, 'missiles:resolved', {
        strikeId: outcome.strike.id,
        result: outcome.result,
      });
    }
    return true;
  }
}

