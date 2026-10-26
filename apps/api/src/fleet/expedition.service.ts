import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EXPEDITION_TECH_ID,
  SHIPS,
  expeditionDelayFactor,
  expeditionPirateLossFraction,
  expeditionResourceFind,
  expeditionShipFind,
  expeditionSpeedupFactor,
  bossIntercepts,
  pickExpeditionOutcome,
  type ExpeditionOutcome,
} from '@xnova/game-config';
import { computeCargoCapacity } from '@xnova/game-engine';
import { BossService } from '../boss/boss.service';
import { DatabaseService } from '../database/database.service';

/** Flotte telle que lue par la tâche planifiée à l'arrivée. */
interface ExpeditionFleet {
  id: string;
  userId: string;
  ships: unknown;
  cargo: unknown;
  startTime: Date;
  arrivalTime: Date;
  toGalaxy: number;
  toSystem: number;
  fromGalaxy: number;
  fromSystem: number;
  fromPosition: number;
  fromMoon: boolean;
}

@Injectable()
export class ExpeditionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly boss: BossService,
  ) {}

  /** Tirage dans [0, 1[ ; isolé pour pouvoir le forcer dans les tests. */
  protected random(): number {
    return Math.random();
  }

  /**
   * Résout l'expédition arrivée en position 16 : tire une issue, l'applique à la flotte (qui rentre ensuite
   * normalement) et enregistre un rapport. Une seule exécution par flotte (prise en charge atomique).
   */
  async resolveExpedition(fleet: ExpeditionFleet): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const claimed = await tx.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      if (claimed.count !== 1) return false;

      const tech = await tx.technology.findUnique({
        where: { userId_techId: { userId: fleet.userId, techId: EXPEDITION_TECH_ID } },
        select: { level: true },
      });
      const techLevel = tech?.level ?? 0;

      const sent = this.readShips(fleet.ships);

      // Le boss galactique du système peut intercepter l'expédition : combat, puis retour des survivants
      const bossConfig = await this.boss.config();
      const bossHere = bossConfig.enabled ? await this.boss.aliveAt(fleet.toGalaxy, fleet.toSystem, tx) : null;
      if (bossHere && bossIntercepts(this.random(), bossConfig.aggroChance)) {
        const originId = await this.boss.originPlanetId(tx, fleet);
        const fought = originId
          ? await this.boss.engage(
              tx,
              { userId: fleet.userId, planetId: originId, ships: sent, source: 'EXPEDITION', galaxy: fleet.toGalaxy, system: fleet.toSystem },
              bossConfig,
            )
          : null;
        if (fought) {
          const left = fought.survivors;
          const destroyed = Object.values(left).reduce((sum, n) => sum + n, 0) === 0;
          await tx.fleet.update({
            where: { id: fleet.id },
            data: destroyed
              ? { status: 'completed', ships: {}, cargo: {}, returnTime: null }
              : { ships: left as unknown as object },
          });
          await tx.expeditionReport.create({
            data: {
              userId: fleet.userId,
              galaxy: fleet.toGalaxy,
              system: fleet.toSystem,
              outcome: 'boss',
              details: {
                result: fought.result,
                rounds: fought.rounds,
                damage: fought.damage,
                bossHealthAfter: fought.bossHealthAfter,
                killed: fought.killed,
                lost: fought.attackerLosses,
                bossLosses: fought.bossLosses,
                loot: fought.loot,
              } as object,
              ships: sent as object,
            },
          });
          return true;
        }
      }

      const ships = { ...sent };
      const cargo = this.readCargo(fleet.cargo);
      const fleetSize = Object.values(ships).reduce((sum, n) => sum + n, 0);
      const outcome: ExpeditionOutcome = pickExpeditionOutcome(this.random());
      const details: Record<string, unknown> = {};
      const update: Record<string, unknown> = {};
      const flightSeconds = Math.max(
        1,
        Math.floor((fleet.arrivalTime.getTime() - fleet.startTime.getTime()) / 1000),
      );

      if (outcome === 'resources') {
        const capacity = computeCargoCapacity(ships, 0);
        const found = expeditionResourceFind({
          capacity,
          usedCargo: cargo.metal + cargo.crystal + cargo.deuterium,
          techLevel,
          amountRoll: this.random(),
          typeRoll: this.random(),
        });
        if (found.amount > 0) {
          cargo[found.resource] += found.amount;
          update.cargo = cargo;
        }
        details.resource = found.resource;
        details.amount = found.amount;
      } else if (outcome === 'ships') {
        const found = expeditionShipFind({
          fleetSize,
          amountRoll: this.random(),
          typeRoll: this.random(),
        });
        ships[found.shipId] = (ships[found.shipId] ?? 0) + found.amount;
        update.ships = ships;
        details.shipId = found.shipId;
        details.amount = found.amount;
      } else if (outcome === 'delay' || outcome === 'speedup') {
        const factor =
          outcome === 'delay' ? expeditionDelayFactor(this.random()) : expeditionSpeedupFactor(this.random());
        // Le retour part de l'arrivée : la durée du trajet est multipliée par le facteur
        update.returnTime = new Date(fleet.arrivalTime.getTime() + Math.round(flightSeconds * factor) * 1000);
        details.factor = Math.round(factor * 100) / 100;
      } else if (outcome === 'pirates') {
        const fraction = expeditionPirateLossFraction(this.random());
        const lost: Record<number, number> = {};
        for (const [id, amount] of Object.entries(ships)) {
          const losses = Math.floor(amount * fraction);
          if (losses > 0) {
            lost[Number(id)] = losses;
            ships[Number(id)] = amount - losses;
          }
        }
        update.ships = ships;
        details.fraction = Math.round(fraction * 100) / 100;
        details.lost = lost;
      } else if (outcome === 'blackhole') {
        details.lost = sent;
      }

      if (outcome === 'blackhole') {
        // Flotte engloutie, cargaison comprise : rien ne revient
        update.status = 'completed';
        update.ships = {};
        update.cargo = {};
        update.returnTime = null;
      }

      if (Object.keys(update).length > 0) {
        await tx.fleet.update({ where: { id: fleet.id }, data: update });
      }

      await tx.expeditionReport.create({
        data: {
          userId: fleet.userId,
          galaxy: fleet.toGalaxy,
          system: fleet.toSystem,
          outcome,
          details: details as object,
          ships: sent as object,
        },
      });
      return true;
    });
  }

  async getReports(userId: string) {
    return this.database.expeditionReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getReport(reportId: string, userId: string) {
    const report = await this.database.expeditionReport.findFirst({ where: { id: reportId, userId } });
    if (!report) throw new NotFoundException('Rapport introuvable');
    return report;
  }

  private readShips(raw: unknown): Record<number, number> {
    const result: Record<number, number> = {};
    for (const [id, amount] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
      const n = Math.floor(Number(amount));
      if (SHIPS[Number(id)] && Number.isFinite(n) && n > 0) result[Number(id)] = n;
    }
    return result;
  }

  private readCargo(raw: unknown) {
    const cargo = (raw ?? {}) as Record<string, unknown>;
    const read = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    };
    return { metal: read(cargo.metal), crystal: read(cargo.crystal), deuterium: read(cargo.deuterium) };
  }
}
