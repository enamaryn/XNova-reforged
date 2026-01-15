import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResearchService } from './research.service';
import { StartResearchDto } from './dto/start-research.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  /**
   * GET /technologies
   * Liste des technologies disponibles (par planète)
   */
  @Get('technologies')
  getTechnologies(
    @Query('planetId') planetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.researchService.getAvailableTechnologies(planetId, userId);
  }

  /**
   * POST /research
   * Démarrer une recherche
   */
  @Post('research')
  startResearch(
    @Body() dto: StartResearchDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.researchService.startResearch(dto.planetId, dto.techId, userId);
  }

  /**
   * GET /research-queue
   * Voir la file de recherche
   */
  @Get('research-queue')
  getResearchQueue(@CurrentUser('id') userId: string) {
    return this.researchService.getResearchQueue(userId);
  }

  /**
   * DELETE /research-queue/:queueId
   * Annuler une recherche
   */
  @Delete('research-queue/:queueId')
  cancelResearch(
    @Param('queueId') queueId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.researchService.cancelResearch(queueId, userId);
  }
}
