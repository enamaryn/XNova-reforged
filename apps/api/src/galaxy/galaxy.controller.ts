import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GalaxyService } from './galaxy.service';

@UseGuards(JwtAuthGuard)
@Controller('galaxy')
export class GalaxyController {
  constructor(private readonly galaxyService: GalaxyService) {}

  @Get(':galaxy/:system')
  getSystem(
    @Param('galaxy') galaxy: string,
    @Param('system') system: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.galaxyService.getSystem(Number(galaxy), Number(system), userId);
  }
}
