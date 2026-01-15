import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResourcesService } from './resources.service';

@UseGuards(JwtAuthGuard)
@Controller('planets')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get(':planetId')
  getPlanet(
    @Param('planetId') planetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.resourcesService.getPlanet(planetId, userId);
  }

  @Get(':planetId/resources')
  getPlanetResources(
    @Param('planetId') planetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.resourcesService.getPlanetResources(planetId, userId);
  }
}
