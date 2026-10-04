import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ESPIONAGE_PROBE_ID, ESPIONAGE_TECH_ID } from '@xnova/game-config';
import { updateResources, type ResourceLevels } from '@xnova/game-engine';
import { DatabaseService } from '../database/database.service';
import { GameEventsGateway } from '../game-events/game-events.gateway';
import { ServerConfigService } from '../server-config/server-config.service';

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

/**
 * Niveau d'information d'un rapport d'espionnage (SCOPE-01) :
 * score = technologie Espionnage de l'attaquant − celle du défenseur + (sondes − 1)
 *   - toujours : ressources de la planète
 *   - score >= 1 : + vaisseaux présents
 *   - score >= 3 : + niveaux des bâtiments
 *   - score >= 5 : + technologies du défenseur
 */
export function computeSpyInfoLevel(attackerTech: number, defenderTech: number, probes: number) {
  const score = attackerTech - defenderTech + (Math.max(1, probes) - 1);
  if (score >= 5) return 3;
  if (score >= 3) return 2;
  if (score >= 1) return 1;
  return 0;
}

/**
 * Mission d'espionnage : à l'arrivée, produit un rapport pour l'attaquant ; les sondes rentrent
 * toujours (elles ne sont pas détruites dans cette version) et la cible n'est pas prévenue.
 */
@Injectable()
export class SpyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
    private readonly gameEvents: GameEventsGateway,
  ) {}

  /** @returns true si cette exécution a pris la flotte en charge (sinon un autre worker l'a traitée). */
  async resolveSpyMission(fleet: {
    id: string;
    userId: string;
    ships: unknown;
    toGalaxy: number;
    toSystem: number;
    toPosition: number;
  }): Promise<boolean> {
    const resourceConfig = await this.serverConfig.getResourceConfig();

    const reportId = await this.database.$transaction(async (tx) => {
      // Prise en charge atomique (ECO-04) : un seul rapport par arrivée
      const claimed = await tx.fleet.updateMany({
        where: { id: fleet.id, status: 'traveling' },
        data: { status: 'returning' },
      });
      if (claimed.count !== 1) return undefined;

      const target = await tx.planet.findUnique({
        where: {
          galaxy_system_position: {
            galaxy: fleet.toGalaxy,
            system: fleet.toSystem,
            position: fleet.toPosition,
          },
        },
      });
      // Cible disparue ou devenue propre planète : les sondes rentrent sans rapport
      if (!target || target.userId === fleet.userId) return null;

      const probes = Number((fleet.ships as Record<string, number>)[ESPIONAGE_PROBE_ID] ?? 0);
      const [attackerTechRow, defenderTechRow] = await Promise.all([
        tx.technology.findUnique({
          where: { userId_techId: { userId: fleet.userId, techId: ESPIONAGE_TECH_ID } },
        }),
        tx.technology.findUnique({
          where: { userId_techId: { userId: target.userId, techId: ESPIONAGE_TECH_ID } },
        }),
      ]);
      const infoLevel = computeSpyInfoLevel(
        attackerTechRow?.level ?? 0,
        defenderTechRow?.level ?? 0,
        probes,
      );

      // Ressources actuelles (production non encore enregistrée incluse), sans rien écrire
      const levels: ResourceLevels = {
        metalMine: target.metalMine,
        crystalMine: target.crystalMine,
        deuteriumMine: target.deuteriumMine,
        solarPlant: target.solarPlant,
        fusionPlant: target.fusionPlant,
        metalStorage: target.metalStorage,
        crystalStorage: target.crystalStorage,
        deuteriumStorage: target.deuteriumStorage,
      };
      const current = updateResources({
        resources: { metal: target.metal, crystal: target.crystal, deuterium: target.deuterium },
        levels,
        lastUpdate: target.lastUpdate,
        now: new Date(),
        config: resourceConfig,
      }).resources;

      const data: Record<string, unknown> = {
        resources: {
          metal: Math.floor(current.metal),
          crystal: Math.floor(current.crystal),
          deuterium: Math.floor(current.deuterium),
        },
      };

      if (infoLevel >= 1) {
        const ships = await tx.ship.findMany({
          where: { planetId: target.id, amount: { gt: 0 } },
          select: { shipId: true, amount: true },
        });
        data.ships = Object.fromEntries(ships.map((s) => [s.shipId, s.amount]));
      }
      if (infoLevel >= 2) {
        const defenses = await tx.defense.findMany({
          where: { planetId: target.id, amount: { gt: 0 } },
          select: { defenseId: true, amount: true },
        });
        data.defenses = Object.fromEntries(defenses.map((d) => [d.defenseId, d.amount]));
        data.buildings = Object.fromEntries(
          BUILDING_FIELDS.map((field) => [field, target[field] as number]),
        );
      }
      if (infoLevel >= 3) {
        const techs = await tx.technology.findMany({
          where: { userId: target.userId },
          select: { techId: true, level: true },
        });
        data.technologies = Object.fromEntries(techs.map((t) => [t.techId, t.level]));
      }

      const report = await tx.spyReport.create({
        data: {
          attackerId: fleet.userId,
          defenderId: target.userId,
          galaxy: target.galaxy,
          system: target.system,
          position: target.position,
          planetName: target.name,
          probes,
          infoLevel,
          data: data as object,
        },
      });
      return report.id;
    });

    if (reportId === undefined) return false;

    if (reportId) {
      this.gameEvents.emitToUser(fleet.userId, 'spy:report', { reportId });
    }
    return true;
  }

  async getReports(userId: string) {
    return this.database.spyReport.findMany({
      where: { attackerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        galaxy: true,
        system: true,
        position: true,
        planetName: true,
        probes: true,
        infoLevel: true,
        createdAt: true,
      },
    });
  }

  async getReport(reportId: string, userId: string) {
    const report = await this.database.spyReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Rapport introuvable');
    }
    // Seul l'espion lit son rapport (la cible n'est pas informée de son contenu)
    if (report.attackerId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }
    return report;
  }
}
