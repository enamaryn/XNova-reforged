import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JUMP_GATE_ID,
  PHALANX_ID,
  PHALANX_SCAN_COST,
  SHIPS,
  SOLAR_SATELLITE_ID,
  jumpGateCooldownSeconds,
  phalanxRange,
} from '@xnova/game-config';
import { debitResources, debitShips, lockPlanet } from '../common/atomic';
import { itemName } from '../common/request-locale';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';
import { JumpDto, PhalanxScanDto } from './dto/moon.dto';

/** Borne haute d'une quantité de vaisseaux dans un saut. */
const MAX_JUMP_AMOUNT = 1_000_000_000;

@Injectable()
export class MoonsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  private async ownedMoon(moonId: string, userId: string) {
    const moon = await this.database.planet.findUnique({ where: { id: moonId } });
    if (!moon) throw new NotFoundException('Lune introuvable');
    if (moon.userId !== userId) throw new ForbiddenException('Acces refuse');
    if (!moon.isMoon) throw new BadRequestException("Cette action s'adresse a une lune");
    return moon;
  }

  /** Niveaux, portée de la phalange et état de la porte de saut, avec les autres portes du joueur. */
  async overview(moonId: string, userId: string) {
    const moon = await this.ownedMoon(moonId, userId);
    const { fleetSpeed } = await this.serverConfig.getConfig();
    const gates = await this.database.planet.findMany({
      where: { userId, isMoon: true, jumpGate: { gte: 1 }, id: { not: moon.id } },
      select: {
        id: true, name: true, galaxy: true, system: true, position: true, jumpGate: true, jumpGateReadyAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      moonId: moon.id,
      deuterium: moon.deuterium,
      phalanx: {
        level: moon.phalanx,
        range: phalanxRange(moon.phalanx),
        cost: PHALANX_SCAN_COST,
        galaxy: moon.galaxy,
        system: moon.system,
      },
      jumpGate: {
        level: moon.jumpGate,
        readyAt: moon.jumpGateReadyAt,
        cooldownSeconds: jumpGateCooldownSeconds(fleetSpeed),
        destinations: gates,
      },
    };
  }

  /**
   * Phalange de capteur : liste les mouvements de flotte qui partent de, ou arrivent vers, une planète
   * d'un autre joueur située à portée (même galaxie). Un balayage coûte du deutérium de la lune.
   */
  async scan(moonId: string, dto: PhalanxScanDto, userId: string) {
    const moon = await this.ownedMoon(moonId, userId);
    if (moon.phalanx < 1) {
      throw new BadRequestException(`${itemName({ id: PHALANX_ID, name: 'Phalange de Capteur' })} requise`);
    }
    if (dto.galaxy !== moon.galaxy) {
      throw new BadRequestException('Cible hors de portee de la phalange');
    }
    if (Math.abs(dto.system - moon.system) > phalanxRange(moon.phalanx)) {
      throw new BadRequestException('Cible hors de portee de la phalange');
    }
    const target = await this.database.planet.findUnique({
      where: {
        galaxy_system_position_isMoon: {
          galaxy: dto.galaxy, system: dto.system, position: dto.position, isMoon: false,
        },
      },
      select: { userId: true },
    });
    if (!target) throw new BadRequestException('Aucune planete a cette position');
    if (target.userId === userId) {
      throw new BadRequestException('Vous ne pouvez pas scruter votre propre planete');
    }

    await this.database.$transaction(async (tx) => {
      await lockPlanet(tx, moon.id);
      await debitResources(tx, moon.id, { metal: 0, crystal: 0, deuterium: PHALANX_SCAN_COST });
    });

    const at = { galaxy: dto.galaxy, system: dto.system, position: dto.position };
    const fleets = await this.database.fleet.findMany({
      where: {
        OR: [
          {
            status: { in: ['traveling', 'returning'] },
            fromGalaxy: at.galaxy, fromSystem: at.system, fromPosition: at.position, fromMoon: false,
          },
          {
            status: 'traveling',
            toGalaxy: at.galaxy, toSystem: at.system, toPosition: at.position, toMoon: false,
          },
        ],
      },
      orderBy: { arrivalTime: 'asc' },
      take: 100,
    });

    const movements = fleets
      .map((fleet) => {
        const leavesTarget =
          fleet.fromGalaxy === at.galaxy &&
          fleet.fromSystem === at.system &&
          fleet.fromPosition === at.position &&
          !fleet.fromMoon;
        const direction =
          leavesTarget && fleet.status === 'returning'
            ? 'returning'
            : leavesTarget
              ? 'outbound'
              : 'inbound';
        const ships = (fleet.ships ?? {}) as Record<string, number>;
        return {
          mission: fleet.mission,
          direction,
          from: { galaxy: fleet.fromGalaxy, system: fleet.fromSystem, position: fleet.fromPosition, moon: fleet.fromMoon },
          to: { galaxy: fleet.toGalaxy, system: fleet.toSystem, position: fleet.toPosition, moon: fleet.toMoon },
          time: direction === 'returning' ? fleet.returnTime : fleet.arrivalTime,
          ships: Object.values(ships).reduce((sum, n) => sum + Number(n || 0), 0),
        };
      })
      .sort((a, b) => new Date(a.time ?? 0).getTime() - new Date(b.time ?? 0).getTime());

    return { target: at, cost: PHALANX_SCAN_COST, movements };
  }

  /** Porte de saut : transfère instantanément des vaisseaux entre deux lunes équipées, puis recharge les deux. */
  async jump(moonId: string, dto: JumpDto, userId: string) {
    const from = await this.ownedMoon(moonId, userId);
    if (dto.toMoonId === from.id) {
      throw new BadRequestException('La destination doit etre une autre lune');
    }
    const to = await this.ownedMoon(dto.toMoonId, userId);
    if (from.jumpGate < 1 || to.jumpGate < 1) {
      throw new BadRequestException(
        `${itemName({ id: JUMP_GATE_ID, name: 'Porte de Saut Spatial' })} requise sur les deux lunes`,
      );
    }

    const ships: { shipId: number; amount: number }[] = [];
    for (const [rawId, rawAmount] of Object.entries(dto.ships ?? {})) {
      const shipId = Number(rawId);
      const amount = Number(rawAmount);
      if (!Number.isInteger(shipId) || !SHIPS[shipId]) {
        throw new BadRequestException(`Vaisseau ${rawId} inexistant`);
      }
      if (!Number.isInteger(amount) || amount < 0 || amount > MAX_JUMP_AMOUNT) {
        throw new BadRequestException('Quantite invalide');
      }
      if (shipId === SOLAR_SATELLITE_ID) {
        throw new BadRequestException('Les satellites solaires restent en orbite');
      }
      if (amount > 0) ships.push({ shipId, amount });
    }
    if (ships.length === 0) throw new BadRequestException('Aucun vaisseau selectionne');

    const { fleetSpeed } = await this.serverConfig.getConfig();
    const cooldown = jumpGateCooldownSeconds(fleetSpeed);

    const readyAt = await this.database.$transaction(async (tx) => {
      // Même ordre de verrouillage pour deux sauts croisés : pas d'interblocage
      for (const id of [from.id, to.id].sort()) await lockPlanet(tx, id);
      const now = new Date();
      const rows = await tx.planet.findMany({
        where: { id: { in: [from.id, to.id] } },
        select: { id: true, jumpGate: true, jumpGateReadyAt: true },
      });
      for (const row of rows) {
        if (row.jumpGate < 1) throw new BadRequestException('Porte de saut requise sur les deux lunes');
        if (row.jumpGateReadyAt && row.jumpGateReadyAt > now) {
          throw new BadRequestException('Porte de saut en cours de recharge');
        }
      }
      for (const ship of ships) {
        await debitShips(
          tx, from.id, ship.shipId, ship.amount,
          `Vaisseaux insuffisants pour ${itemName(SHIPS[ship.shipId])}`,
        );
        await tx.ship.upsert({
          where: { planetId_shipId: { planetId: to.id, shipId: ship.shipId } },
          update: { amount: { increment: ship.amount } },
          create: { planetId: to.id, shipId: ship.shipId, amount: ship.amount },
        });
      }
      const next = new Date(now.getTime() + cooldown * 1000);
      await tx.planet.updateMany({
        where: { id: { in: [from.id, to.id] } },
        data: { jumpGateReadyAt: next },
      });
      return next;
    });

    return { success: true, readyAt, cooldownSeconds: cooldown };
  }
}
