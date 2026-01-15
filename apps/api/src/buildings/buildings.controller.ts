import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BuildingsService } from './buildings.service';
import { StartBuildDto } from './dto/build.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  /**
   * GET /buildings
   * Liste de tous les batiments avec leurs configurations
   */
  @Get('buildings')
  async getAllBuildings() {
    // Importer directement la config pour avoir la liste complete
    const { BUILDINGS } = await import('@xnova/game-config');
    return Object.values(BUILDINGS).map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      category: b.category,
      baseCost: b.baseCost,
      factor: b.factor,
      requirements: b.requirements,
    }));
  }

  /**
   * GET /planets/:id/buildings
   * Liste des batiments disponibles pour une planete avec couts et durees
   */
  @Get('planets/:id/buildings')
  async getPlanetBuildings(
    @Param('id') planetId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.buildingsService.getAvailableBuildings(planetId, user.id);
  }

  /**
   * POST /planets/:id/build
   * Demarre la construction d'un batiment
   */
  @Post('planets/:id/build')
  async startBuild(
    @Param('id') planetId: string,
    @Body() dto: StartBuildDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.buildingsService.startConstruction(
      planetId,
      dto.buildingId,
      user.id,
    );
  }

  /**
   * GET /planets/:id/build-queue
   * Recupere la file d'attente de construction
   */
  @Get('planets/:id/build-queue')
  async getBuildQueue(
    @Param('id') planetId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.buildingsService.getBuildQueue(planetId, user.id);
  }

  /**
   * DELETE /planets/:id/build-queue/:queueId
   * Annule une construction en cours
   */
  @Delete('planets/:id/build-queue/:queueId')
  async cancelBuild(
    @Param('id') planetId: string,
    @Param('queueId') queueId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.buildingsService.cancelConstruction(queueId, user.id);
  }
}
