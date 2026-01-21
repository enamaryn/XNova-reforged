import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CombatResult, MissionType } from '@xnova/game-config';
import {
  computeCargoCapacity,
  distributeLoot,
  simulateCombat,
  type CombatResultSummary,
} from '@xnova/game-engine';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';

interface CombatTechLevels {
  weapon: number;
  shield: number;
  armor: number;
  hyperspace: number;
}

@Injectable()
export class CombatService {
  constructor(
    private readonly database: DatabaseService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  /**
   * Resolve une mission d'attaque en simulant le combat complet.
   *
   * Etapes:
   * 1. Charge la cible et les flottes des deux camps.
   * 2. Calcule le combat (rapid fire, boucliers, coques).
   * 3. Determine les survivants et le butin possible.
   * 4. Met a jour la base (flottes, planetes, rapports).
   *
   * @param fleet - Flotte attaquante avec position et chargement.
   * @returns Rapport de combat cree ou null si pas de cible.
   */
  async resolveAttackMission(fleet: {
    id: string;
    userId: string;
    mission: number;
    ships: any;
    cargo: any;
    startTime: Date;
    arrivalTime: Date;
    returnTime: Date | null;
    status: string;
    fromGalaxy: number;
    fromSystem: number;
    fromPosition: number;
    toGalaxy: number;
    toSystem: number;
    toPosition: number;
  }) {
    if (fleet.mission !== MissionType.ATTACK) {
      return null;
    }

    const target = await this.database.planet.findFirst({
      where: {
        galaxy: fleet.toGalaxy,
        system: fleet.toSystem,
        position: fleet.toPosition,
      },
    });

    if (!target) {
      await this.database.fleet.update({
        where: { id: fleet.id },
        data: { status: 'returning' },
      });
      return null;
    }

    const attackerShips = this.normalizeShipMap(fleet.ships);
    const defenderShipRows = await this.database.ship.findMany({
      where: { planetId: target.id },
      select: { shipId: true, amount: true },
    });
    const defenderShips = defenderShipRows.reduce((acc, row) => {
      acc[row.shipId] = row.amount;
      return acc;
    }, {} as Record<number, number>);

    const attackerTech = await this.getCombatTechLevels(fleet.userId);
    const defenderTech = await this.getCombatTechLevels(target.userId);

    const combat = simulateCombat({
      attackerShips,
      defenderShips,
      attackerTech: {
        weapon: attackerTech.weapon,
        shield: attackerTech.shield,
        armor: attackerTech.armor,
      },
      defenderTech: {
        weapon: defenderTech.weapon,
        shield: defenderTech.shield,
        armor: defenderTech.armor,
      },
    });

    const attackerSurvivors = combat.attackerRemaining;
    const defenderSurvivors = combat.defenderRemaining;
    const attackerTotal = this.countShips(attackerSurvivors);

    const maxLoot = {
      metal: Math.floor(target.metal * 0.5),
      crystal: Math.floor(target.crystal * 0.5),
      deuterium: Math.floor(target.deuterium * 0.5),
    };

    const loot =
      combat.result === CombatResult.ATTACKER_WIN && attackerTotal > 0
        ? distributeLoot({
            maxLoot,
            capacity: computeCargoCapacity(attackerSurvivors, attackerTech.hyperspace),
          })
        : { metal: 0, crystal: 0, deuterium: 0 };

    const reportData = this.buildReportData({
      attackerId: fleet.userId,
      defenderId: target.userId,
      attackerShips,
      defenderShips,
      combat,
      loot,
      location: {
        galaxy: fleet.toGalaxy,
        system: fleet.toSystem,
        position: fleet.toPosition,
      },
    });

    const existingDefenderShipIds = new Set<number>();
    defenderShipRows.forEach((row) => existingDefenderShipIds.add(row.shipId));

    const shipIds = new Set<number>(existingDefenderShipIds);
    Object.keys(defenderSurvivors).forEach((shipId) => shipIds.add(Number(shipId)));

    const shipUpdates = Array.from(shipIds).flatMap((shipId) => {
      const amount = defenderSurvivors[shipId] ?? 0;
      if (amount === 0 && !existingDefenderShipIds.has(shipId)) {
        return [];
      }

      return this.database.ship.upsert({
        where: { planetId_shipId: { planetId: target.id, shipId } },
        update: { amount },
        create: { planetId: target.id, shipId, amount },
      });
    });

    const fleetUpdate =
      attackerTotal > 0
        ? {
            status: 'returning',
            ships: attackerSurvivors,
            cargo: loot,
          }
        : {
            status: 'completed',
            ships: {},
            cargo: {},
            returnTime: null,
          };

    const [report] = await this.database.$transaction([
      this.database.combatReport.create({
        data: reportData,
      }),
      this.database.planet.update({
        where: { id: target.id },
        data: {
          metal: { decrement: loot.metal },
          crystal: { decrement: loot.crystal },
          deuterium: { decrement: loot.deuterium },
        },
      }),
      this.database.fleet.update({
        where: { id: fleet.id },
        data: fleetUpdate,
      }),
      ...shipUpdates,
    ]);

    this.gameEvents.emitToUser(fleet.userId, 'combat:report', {
      reportId: report.id,
      result: report.result,
      opponentId: target.userId,
    });

    this.gameEvents.emitToUser(target.userId, 'combat:report', {
      reportId: report.id,
      result: report.result,
      opponentId: fleet.userId,
    });

    return report;
  }

  async getReports(userId: string) {
    return this.database.combatReport.findMany({
      where: {
        OR: [{ attackerId: userId }, { defenderId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        attackerId: true,
        defenderId: true,
        result: true,
        createdAt: true,
      },
    });
  }

  async getReportById(reportId: string, userId: string) {
    const report = await this.database.combatReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Rapport introuvable');
    }

    if (report.attackerId !== userId && report.defenderId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    return report;
  }

  private buildReportData(params: {
    attackerId: string;
    defenderId: string;
    attackerShips: Record<number, number>;
    defenderShips: Record<number, number>;
    combat: CombatResultSummary;
    loot: { metal: number; crystal: number; deuterium: number };
    location: { galaxy: number; system: number; position: number };
  }): Prisma.CombatReportCreateInput {
    return {
      attackerId: params.attackerId,
      defenderId: params.defenderId,
      attackerShips: params.attackerShips as Prisma.InputJsonValue,
      defenderShips: params.defenderShips as Prisma.InputJsonValue,
      defenderDefs: {} as Prisma.InputJsonValue,
      attackerLosses: params.combat.attackerLosses as Prisma.InputJsonValue,
      defenderLosses: params.combat.defenderLosses as Prisma.InputJsonValue,
      result: params.combat.result,
      rounds: params.combat.rounds,
      timeline: params.combat.timeline as unknown as Prisma.InputJsonValue,
      loot: params.loot as Prisma.InputJsonValue,
      debris: params.combat.debris as Prisma.InputJsonValue,
      galaxy: params.location.galaxy,
      system: params.location.system,
      position: params.location.position,
    };
  }

  private normalizeShipMap(raw: any): Record<number, number> {
    if (!raw || typeof raw !== 'object') return {};
    return Object.entries(raw).reduce((acc, [shipIdRaw, countRaw]) => {
      const shipId = Number(shipIdRaw);
      const count = Math.max(0, Math.floor(Number(countRaw)));
      if (count > 0) {
        acc[shipId] = count;
      }
      return acc;
    }, {} as Record<number, number>);
  }

  private countShips(ships: Record<number, number>) {
    return Object.values(ships).reduce((sum, amount) => sum + amount, 0);
  }

  private async getCombatTechLevels(userId: string): Promise<CombatTechLevels> {
    const techRows = await this.database.technology.findMany({
      where: { userId, techId: { in: [109, 110, 111, 118] } },
      select: { techId: true, level: true },
    });

    const levels = new Map<number, number>();
    techRows.forEach((row) => levels.set(row.techId, row.level));

    return {
      weapon: levels.get(109) ?? 0,
      armor: levels.get(110) ?? 0,
      shield: levels.get(111) ?? 0,
      hyperspace: levels.get(118) ?? 0,
    };
  }
}
