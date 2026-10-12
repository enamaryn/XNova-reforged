import { OfficersService } from '../officers/officers.service';
import { FleetCommandersService } from '../fleet-commanders/fleet-commanders.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServerConfigService } from '../server-config/server-config.service';
import {
  COLONY_SHIP_ID,
  COMPUTER_TECH_ID,
  EXPEDITION_POSITION,
  EXPEDITION_TECH_ID,
  ESPIONAGE_PROBE_ID,
  RECYCLER_ID,
  GAME_CONSTANTS,
  HOLD_MAX_HOURS,
  IMPLEMENTED_MISSIONS,
  MissionType,
  SHIPS,
  SOLAR_SATELLITE_ID,
  getShipSpeed,
  holdFuelPerHour,
  maxExpeditions,
  maxFleetSlots,
} from '@xnova/game-config';
import {
  calculateDistance,
  calculateFleetSpeed,
  calculateFlightDurationSeconds,
  calculateFuelConsumption,
} from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';
import { debitResources, debitShips, lockPlanet, lockUser } from '../common/atomic';
import { MAX_QUANTITY, SendFleetDto } from './dto/send-fleet.dto';
import { itemName } from '../common/request-locale';

@Injectable()
export class FleetService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly officers: OfficersService,
    private readonly commanders: FleetCommandersService,
  ) {}

  async getAvailableShips(planetId: string, userId: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: planetId },
      select: { id: true, userId: true },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    const ships = await this.database.ship.findMany({
      where: { planetId },
      select: { shipId: true, amount: true },
    });

    const amounts = new Map<number, number>();
    ships.forEach((ship) => amounts.set(ship.shipId, ship.amount));

    const shipList = Object.values(SHIPS)
      .filter((ship) => ship.id !== SOLAR_SATELLITE_ID)
      .map((ship) => ({
        shipId: ship.id,
        name: itemName(ship),
        amount: amounts.get(ship.id) ?? 0,
      }));

    const [inFlight, computer] = await Promise.all([
      this.database.fleet.count({ where: { userId, status: { in: ['traveling', 'returning'] } } }),
      this.database.technology.findUnique({
        where: { userId_techId: { userId, techId: COMPUTER_TECH_ID } },
        select: { level: true },
      }),
    ]);

    return {
      planetId,
      ships: shipList,
      // Flottes en vol : 1 de base, plus 1 par niveau de la technologie Ordinateur
      fleetSlots: { inFlight, max: maxFleetSlots(computer?.level ?? 0) },
    };
  }

  async getActiveFleets(userId: string) {
    const fleets = await this.database.fleet.findMany({
      where: {
        userId,
        status: { in: ['traveling', 'arrived', 'holding', 'returning'] },
      },
      orderBy: { arrivalTime: 'asc' },
      select: {
        id: true,
        fromGalaxy: true,
        fromSystem: true,
        fromPosition: true,
        toGalaxy: true,
        toSystem: true,
        toPosition: true,
        fromMoon: true,
        toMoon: true,
        mission: true,
        ships: true,
        cargo: true,
        startTime: true,
        arrivalTime: true,
        returnTime: true,
        holdHours: true,
        holdUntil: true,
        status: true,
      },
    });

    return fleets;
  }

  async sendFleet(dto: SendFleetDto, userId: string) {
    const planet = await this.database.planet.findUnique({
      where: { id: dto.planetId },
    });

    if (!planet) {
      throw new NotFoundException('Planete introuvable');
    }

    if (planet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    // Règles de validation (GAME-01) : tout est refusé avant le moindre débit
    if (!IMPLEMENTED_MISSIONS.includes(dto.mission)) {
      throw new BadRequestException('Mission non disponible');
    }

    // Seule une expédition vise la position 16 de l'espace profond, et elle ne vise que celle-ci
    const isExpedition = dto.mission === MissionType.EXPEDITION;
    const maxPosition = isExpedition ? EXPEDITION_POSITION : GAME_CONSTANTS.MAX_POSITIONS;
    if (
      dto.toGalaxy < 1 ||
      dto.toGalaxy > GAME_CONSTANTS.MAX_GALAXIES ||
      dto.toSystem < 1 ||
      dto.toSystem > GAME_CONSTANTS.MAX_SYSTEMS ||
      dto.toPosition < 1 ||
      dto.toPosition > maxPosition
    ) {
      throw new BadRequestException('Coordonnees invalides');
    }
    if (isExpedition && dto.toPosition !== EXPEDITION_POSITION) {
      throw new BadRequestException("Une expedition vise la position 16 de l'espace profond");
    }

    const shipsToSend = this.parseShips(dto.ships);

    // Durée du maintien (heures) : obligatoire pour le maintien de position, interdite sinon
    if (dto.mission === MissionType.HOLD_POSITION) {
      if (
        typeof dto.holdHours !== 'number' ||
        !Number.isInteger(dto.holdHours) ||
        dto.holdHours < 1 ||
        dto.holdHours > HOLD_MAX_HOURS
      ) {
        throw new BadRequestException(`La duree du maintien doit etre de 1 a ${HOLD_MAX_HOURS} heures`);
      }
    } else if (dto.holdHours !== undefined) {
      throw new BadRequestException("La duree de maintien ne concerne que le maintien de position");
    }

    const toMoon = dto.toMoon === true;
    if (
      planet.galaxy === dto.toGalaxy &&
      planet.system === dto.toSystem &&
      planet.position === dto.toPosition &&
      planet.isMoon === toMoon
    ) {
      throw new BadRequestException('La destination ne peut pas etre la planete d\'origine');
    }

    const target = await this.database.planet.findUnique({
      where: {
        galaxy_system_position_isMoon: {
          galaxy: dto.toGalaxy,
          system: dto.toSystem,
          position: dto.toPosition,
          isMoon: toMoon,
        },
      },
      select: { userId: true },
    });

    if (toMoon && (dto.mission === MissionType.COLONIZE || dto.mission === MissionType.RECYCLE)) {
      throw new BadRequestException('Cette mission ne peut pas viser une lune');
    }

    if (dto.mission === MissionType.ATTACK) {
      if (!target) throw new BadRequestException(toMoon ? 'Aucune lune a cette position' : 'Aucune planete a cette position');
      if (target.userId === userId) {
        throw new BadRequestException('Vous ne pouvez pas attaquer votre propre planete');
      }
    } else if (dto.mission === MissionType.DEPLOY) {
      if (!target || target.userId !== userId) {
        throw new BadRequestException('Le deploiement exige une de vos planetes');
      }
    } else if (dto.mission === MissionType.HOLD_POSITION) {
      // Maintien de position : planète ou lune d'un autre membre de votre alliance, pour une durée choisie
      if (!target) throw new BadRequestException(toMoon ? 'Aucune lune a cette position' : 'Aucune planete a cette position');
      if (target.userId === userId) {
        throw new BadRequestException("Le maintien de position vise la planete d'un allie, pas la votre");
      }
      const [mine, theirs] = await Promise.all([
        this.database.allianceMember.findUnique({ where: { userId }, select: { allianceId: true } }),
        this.database.allianceMember.findUnique({ where: { userId: target.userId }, select: { allianceId: true } }),
      ]);
      if (!mine || !theirs || mine.allianceId !== theirs.allianceId) {
        throw new BadRequestException("Le maintien de position exige la planete d'un membre de votre alliance");
      }
    } else if (dto.mission === MissionType.SPY) {
      // Espionnage : uniquement des sondes, vers la planete d'un autre joueur
      if (shipsToSend.some((ship) => ship.shipId !== ESPIONAGE_PROBE_ID)) {
        throw new BadRequestException('Une mission d\'espionnage n\'accepte que des sondes d\'espionnage');
      }
      if (!target) throw new BadRequestException('Aucune planete a cette position');
      if (target.userId === userId) {
        throw new BadRequestException('Vous ne pouvez pas espionner votre propre planete');
      }
    } else if (dto.mission === MissionType.COLONIZE) {
      // Colonisation : au moins un vaisseau de colonisation, vers une position libre
      if (!shipsToSend.some((ship) => ship.shipId === COLONY_SHIP_ID)) {
        throw new BadRequestException('Une mission de colonisation exige un vaisseau de colonisation');
      }
      if (target) throw new BadRequestException('Cette position est deja occupee');
      const owned = await this.database.planet.count({ where: { userId, isMoon: false } });
      if (owned >= GAME_CONSTANTS.MAX_PLAYER_PLANETS) {
        throw new BadRequestException('Nombre maximal de planetes atteint');
      }
    } else if (dto.mission === MissionType.RECYCLE) {
      // Recyclage : uniquement des recycleurs, vers un champ de débris non vide
      if (shipsToSend.some((ship) => ship.shipId !== RECYCLER_ID)) {
        throw new BadRequestException('Une mission de recyclage n\'accepte que des recycleurs');
      }
      const debris = await this.database.debrisField.findUnique({
        where: {
          galaxy_system_position: {
            galaxy: dto.toGalaxy,
            system: dto.toSystem,
            position: dto.toPosition,
          },
        },
        select: { metal: true, crystal: true },
      });
      if (!debris || debris.metal + debris.crystal < 1) {
        throw new BadRequestException('Aucun champ de débris à ces coordonnées');
      }
    } else if (dto.mission === MissionType.EXPEDITION) {
      // Expédition : technologie requise, nombre d'expéditions simultanées limité, aucune cible à vérifier
      if (toMoon) throw new BadRequestException('Une expedition ne vise pas une lune');
      const tech = await this.database.technology.findUnique({
        where: { userId_techId: { userId, techId: EXPEDITION_TECH_ID } },
        select: { level: true },
      });
      const level = tech?.level ?? 0;
      if (level < 1) {
        throw new BadRequestException('La technologie Expedition est requise');
      }
      const running = await this.database.fleet.count({
        where: { userId, mission: MissionType.EXPEDITION, status: { in: ['traveling', 'returning'] } },
      });
      const maxSlots = maxExpeditions(level) + (await this.officers.bonusesOf(userId)).extraExpeditions;
      if (running >= maxSlots) {
        throw new BadRequestException(
          `Nombre maximal d'expeditions atteint (${running}/${maxSlots})`,
        );
      }
    } else if (!target) {
      // TRANSPORT : la cible doit exister
      throw new BadRequestException('Aucune planete a cette position');
    }

    const shipRows = await this.database.ship.findMany({
      where: {
        planetId: dto.planetId,
        shipId: { in: shipsToSend.map((s) => s.shipId) },
      },
      select: { shipId: true, amount: true },
    });

    const available = new Map<number, number>();
    shipRows.forEach((row) => available.set(row.shipId, row.amount));

    shipsToSend.forEach((ship) => {
      const amount = available.get(ship.shipId) ?? 0;
      if (amount < ship.amount) {
        throw new BadRequestException(
          `Vaisseaux insuffisants pour ${itemName(SHIPS[ship.shipId])}`,
        );
      }
    });

    const cargo = {
      metal: this.parseQuantity(dto.cargo?.metal),
      crystal: this.parseQuantity(dto.cargo?.crystal),
      deuterium: this.parseQuantity(dto.cargo?.deuterium),
    };

    // Espionnage, colonisation et recyclage n'embarquent aucune ressource
    if (
      (dto.mission === MissionType.SPY ||
      dto.mission === MissionType.COLONIZE ||
      dto.mission === MissionType.RECYCLE) &&
      cargo.metal + cargo.crystal + cargo.deuterium > 0
    ) {
      throw new BadRequestException('Cette mission n\'accepte aucune cargaison');
    }

    const cargoTotal = cargo.metal + cargo.crystal + cargo.deuterium;
    // Le commandant assigné augmente la capacité de cargaison et la vitesse (compétences Cargaison et Vitesse)
    const commanderBonus = await this.commanders.bonusesForSend(userId, dto.commanderId);
    const cargoCapacity = Math.floor(
      shipsToSend.reduce((sum, ship) => sum + SHIPS[ship.shipId].cargo * ship.amount, 0) *
        (1 + commanderBonus.cargo),
    );

    if (cargoTotal > cargoCapacity) {
      throw new BadRequestException('Capacite de cargaison insuffisante');
    }

    const techRows = await this.database.technology.findMany({
      where: { userId, techId: { in: [115, 117, 118] } },
    });
    const techLevels = new Map<number, number>();
    techRows.forEach((row) => techLevels.set(row.techId, row.level));

    const combustion = techLevels.get(115) ?? 0;
    const impulse = techLevels.get(117) ?? 0;
    const hyperspace = techLevels.get(118) ?? 0;

    const shipSpeeds = shipsToSend.map((ship) =>
      getShipSpeed(ship.shipId, combustion, impulse, hyperspace),
    );

    const baseFleetSpeed = calculateFleetSpeed(shipSpeeds);
    // L'amiral accélère toutes les flottes du joueur ; le commandant assigné ajoute sa compétence Vitesse
    const fleetSpeed = baseFleetSpeed
      ? Math.floor(
          baseFleetSpeed *
            (1 + (await this.officers.bonusesOf(userId)).fleetSpeed + commanderBonus.speed),
        )
      : baseFleetSpeed;
    if (!fleetSpeed) {
      throw new BadRequestException('Vitesse flotte invalide');
    }

    const distance = calculateDistance(
      {
        galaxy: planet.galaxy,
        system: planet.system,
        position: planet.position,
      },
      {
        galaxy: dto.toGalaxy,
        system: dto.toSystem,
        position: dto.toPosition,
      },
    );

    const speedPercent = dto.speedPercent || 100;
    const durationSeconds = calculateFlightDurationSeconds({
      distance,
      fleetSpeed,
      speedPercent,
    });

    const fuelConsumption = calculateFuelConsumption({
      distance,
      fleetSpeed,
      ships: shipsToSend.map((ship) => ({
        amount: ship.amount,
        consumption: SHIPS[ship.shipId].consumption,
      })),
    });

    // Carburant du maintien, payé d'avance pour toute la durée (le dépôt d'alliance de l'hôte peut le rembourser)
    const holdFuel =
      dto.mission === MissionType.HOLD_POSITION
        ? holdFuelPerHour(
            Object.fromEntries(shipsToSend.map((ship) => [ship.shipId, ship.amount])),
          ) * (dto.holdHours ?? 0)
        : 0;

    if (
      planet.metal < cargo.metal ||
      planet.crystal < cargo.crystal ||
      planet.deuterium < cargo.deuterium + fuelConsumption + holdFuel
    ) {
      throw new BadRequestException('Ressources insuffisantes');
    }

    const { fleetSpeed: gameSpeed } = await this.serverConfig.getConfig();
    const adjustedDuration = Math.max(
      1,
      Math.floor(durationSeconds / gameSpeed),
    );

    const now = new Date();
    const arrivalTime = new Date(now.getTime() + adjustedDuration * 1000);
    const returnTime = new Date(arrivalTime.getTime() + adjustedDuration * 1000);

    const shipsPayload = shipsToSend.reduce((acc, ship) => {
      acc[ship.shipId] = ship.amount;
      return acc;
    }, {} as Record<number, number>);

    const fleet = await this.database.$transaction(async (tx) => {
      // Verrou joueur (quota de flottes en vol), puis planete et debits conditionnels :
      // pas de stock negatif ni de double usage de vaisseaux (ECO-03)
      await lockUser(tx, userId);
      await this.assertFleetSlot(tx, userId);
      if (dto.commanderId) await this.commanders.assertAssignable(tx, userId, dto.commanderId);
      await lockPlanet(tx, dto.planetId);

      await debitResources(tx, dto.planetId, {
        metal: cargo.metal,
        crystal: cargo.crystal,
        deuterium: cargo.deuterium + fuelConsumption + holdFuel,
      });

      for (const ship of shipsToSend) {
        await debitShips(
          tx,
          dto.planetId,
          ship.shipId,
          ship.amount,
          `Vaisseaux insuffisants pour ${itemName(SHIPS[ship.shipId])}`,
        );
      }

      return tx.fleet.create({
        data: {
          userId,
          fromGalaxy: planet.galaxy,
          fromSystem: planet.system,
          fromPosition: planet.position,
          toGalaxy: dto.toGalaxy,
          toSystem: dto.toSystem,
          toPosition: dto.toPosition,
          fromMoon: planet.isMoon,
          toMoon,
          mission: dto.mission,
          ships: shipsPayload,
          cargo,
          colonyName: dto.mission === MissionType.COLONIZE ? dto.planetName?.trim() || 'Colonie' : null,
          startTime: now,
          arrivalTime,
          returnTime,
          holdHours: dto.mission === MissionType.HOLD_POSITION ? dto.holdHours : null,
          commanderId: dto.commanderId ?? null,
          status: 'traveling',
        },
      });
    });

    return {
      success: true,
      fleetId: fleet.id,
      durationSeconds: adjustedDuration,
      fuelConsumption,
      holdFuel,
      mission: dto.mission,
      arrivalTime,
    };
  }

  /** Flottes en vol : 1 de base, plus 1 par niveau de la technologie Ordinateur. */
  private async assertFleetSlot(
    tx: Pick<Prisma.TransactionClient, 'fleet' | 'technology'>,
    userId: string,
  ) {
    const [inFlight, computer] = await Promise.all([
      tx.fleet.count({ where: { userId, status: { in: ['traveling', 'holding', 'returning'] } } }),
      tx.technology.findUnique({
        where: { userId_techId: { userId, techId: COMPUTER_TECH_ID } },
        select: { level: true },
      }),
    ]);
    const max = maxFleetSlots(computer?.level ?? 0);
    if (inFlight >= max) {
      throw new BadRequestException(
        `Nombre maximal de flottes en vol atteint (${inFlight}/${max}) : la technologie Ordinateur autorise 1 flotte plus 1 par niveau`,
      );
    }
  }

  /** Liste de vaisseaux : identifiants connus, quantités entières strictement positives. */
  private parseShips(raw: unknown): { shipId: number; amount: number }[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('Liste de vaisseaux invalide');
    }

    const result: { shipId: number; amount: number }[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^\d+$/.test(key) || !SHIPS[Number(key)]) {
        throw new BadRequestException(`Vaisseau invalide: ${key}`);
      }
      // Un satellite solaire reste en orbite de sa planète : il ne part jamais en mission
      if (Number(key) === SOLAR_SATELLITE_ID) {
        throw new BadRequestException(
          'Les satellites solaires restent en orbite de leur planete et ne peuvent pas etre envoyes',
        );
      }
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > MAX_QUANTITY
      ) {
        throw new BadRequestException(`Quantite invalide pour le vaisseau ${key}`);
      }
      result.push({ shipId: Number(key), amount: value });
    }

    if (result.length === 0) {
      throw new BadRequestException('Aucun vaisseau selectionne');
    }
    return result;
  }

  /** Quantité de ressources : entier fini compris entre 0 et la borne maximale. */
  private parseQuantity(value: unknown): number {
    if (value === undefined || value === null) return 0;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_QUANTITY) {
      throw new BadRequestException('Quantite de ressources invalide');
    }
    return value;
  }

  async recallFleet(fleetId: string, userId: string) {
    const fleet = await this.database.fleet.findUnique({
      where: { id: fleetId },
    });

    if (!fleet) {
      throw new NotFoundException('Flotte introuvable');
    }

    if (fleet.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    if (fleet.status === 'holding') {
      // Rappel d'une flotte en maintien de position : retour immédiat, sur la durée du trajet aller
      const flightSeconds = Math.max(
        1,
        Math.floor((fleet.arrivalTime.getTime() - fleet.startTime.getTime()) / 1000),
      );
      const holdReturn = new Date(Date.now() + flightSeconds * 1000);
      const ended = await this.database.fleet.updateMany({
        where: { id: fleet.id, status: 'holding' },
        data: { status: 'returning', returnTime: holdReturn, holdUntil: null },
      });
      if (ended.count !== 1) {
        throw new BadRequestException('La flotte ne peut pas etre rappelee');
      }
      return { success: true, fleetId: fleet.id, returnTime: holdReturn };
    }

    if (fleet.status !== 'traveling') {
      throw new BadRequestException('La flotte ne peut pas etre rappelee');
    }

    const now = new Date();
    if (fleet.arrivalTime <= now) {
      throw new BadRequestException('La flotte est deja arrivee');
    }

    const elapsedSeconds = Math.max(
      1,
      Math.floor((now.getTime() - fleet.startTime.getTime()) / 1000),
    );
    const returnTime = new Date(now.getTime() + elapsedSeconds * 1000);

    // Rappel atomique : refuse si la flotte vient d'etre prise en charge par l'arrivee (ECO-04)
    const recalled = await this.database.fleet.updateMany({
      where: { id: fleet.id, status: 'traveling', arrivalTime: { gt: now } },
      data: { status: 'returning', returnTime },
    });
    if (recalled.count !== 1) {
      throw new BadRequestException('La flotte ne peut pas etre rappelee');
    }
    const updatedFleet = await this.database.fleet.findUniqueOrThrow({
      where: { id: fleet.id },
    });

    return {
      success: true,
      fleetId: updatedFleet.id,
      returnTime: updatedFleet.returnTime,
    };
  }

}
