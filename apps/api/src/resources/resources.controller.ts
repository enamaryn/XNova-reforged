import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResourcesService } from './resources.service';
import { ColonizePlanetDto } from './dto/colonize-planet.dto';
import { RenamePlanetDto } from './dto/rename-planet.dto';

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

  @Get('scan/:planetId')
  scanPlanet(@Param('planetId') planetId: string) {
    return this.resourcesService.scanPlanet(planetId);
  }

  @Post('colonize')
  colonizePlanet(
    @Body() dto: ColonizePlanetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.resourcesService.colonizePlanet({
      userId,
      originPlanetId: dto.originPlanetId,
      galaxy: dto.galaxy,
      system: dto.system,
      position: dto.position,
      name: dto.name,
    });
  }

  @Put(':planetId')
  renamePlanet(
    @Param('planetId') planetId: string,
    @Body() dto: RenamePlanetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.resourcesService.renamePlanet(planetId, userId, dto.name);
  }
}
