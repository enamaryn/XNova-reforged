import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OFFICERS,
  OFFICER_COST_DEUTERIUM,
  OFFICER_TYPES,
  isOfficerType,
  officerBonuses,
} from '@xnova/game-config';
import { debitResources, lockPlanet, lockUser } from '../common/atomic';
import { settleBeforeEnergyChange } from '../common/energy';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';

@Injectable()
export class OfficersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  /** Types d'officiers embauchés par le joueur. */
  async hiredTypes(userId: string, client: Pick<DatabaseService, 'officer'> = this.database): Promise<string[]> {
    const rows = await client.officer.findMany({ where: { userId }, select: { type: true } });
    return rows.map((row) => row.type);
  }

  /** Bonus cumulés du joueur (durées, vitesse, files, espionnage…). */
  async bonusesOf(userId: string, client: Pick<DatabaseService, 'officer'> = this.database) {
    return officerBonuses(await this.hiredTypes(userId, client));
  }

  async list(userId: string) {
    const rows = await this.database.officer.findMany({ where: { userId }, select: { type: true, hiredAt: true } });
    const hired = new Map(rows.map((row) => [row.type, row.hiredAt]));
    return {
      cost: OFFICER_COST_DEUTERIUM,
      officers: OFFICER_TYPES.map((type) => ({
        type,
        bonus: OFFICERS[type].bonus,
        hired: hired.has(type),
        hiredAt: hired.get(type) ?? null,
      })),
      active: officerBonuses([...hired.keys()]),
    };
  }

  /**
   * Embauche un officier (définitive) et prélève son prix en deutérium sur la planète choisie.
   * Les bonus de production s'appliquent à partir de maintenant : toutes les planètes du joueur sont réglées avec
   * les anciens bonus avant l'ajout (pas d'effet rétroactif), verrous pris dans l'ordre des identifiants.
   */
  async hire(userId: string, type: string, planetId: string) {
    if (!isOfficerType(type)) throw new NotFoundException('Officier inconnu');
    const planet = await this.database.planet.findUnique({ where: { id: planetId }, select: { userId: true } });
    if (!planet || planet.userId !== userId) throw new NotFoundException('Planete introuvable');

    const energyConfig = await this.serverConfig.getResourceConfig();
    await this.database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const already = await this.hiredTypes(userId, tx);
      if (already.includes(type)) throw new ConflictException('Officier deja embauche');

      const planets = await tx.planet.findMany({ where: { userId }, select: { id: true }, orderBy: { id: 'asc' } });
      for (const { id } of planets) {
        await lockPlanet(tx, id);
        await settleBeforeEnergyChange(tx, id, energyConfig, { officers: [...already, type] });
      }
      try {
        await debitResources(tx, planetId, { metal: 0, crystal: 0, deuterium: OFFICER_COST_DEUTERIUM });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(`Deuterium insuffisant : ${OFFICER_COST_DEUTERIUM} requis sur cette planete`);
        }
        throw error;
      }
      await tx.officer.create({ data: { userId, type } });
    });
    return this.list(userId);
  }
}
