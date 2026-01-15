import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BuildShipDto } from './dto/build-ship.dto';
import { ShipyardService } from './shipyard.service';

@UseGuards(JwtAuthGuard)
@Controller('shipyard')
export class ShipyardController {
  constructor(private readonly shipyardService: ShipyardService) {}

  @Get()
  getShipyard(@Query('planetId') planetId: string, @CurrentUser('id') userId: string) {
    return this.shipyardService.getShipyard(planetId, userId);
  }

  @Post('build')
  startBuild(@Body() dto: BuildShipDto, @CurrentUser('id') userId: string) {
    return this.shipyardService.startBuild(dto.planetId, dto.shipId, dto.amount, userId);
  }

  @Get('queue')
  getQueue(@Query('planetId') planetId: string, @CurrentUser('id') userId: string) {
    return this.shipyardService.getShipyardQueue(planetId, userId);
  }

  @Delete('queue/:queueId')
  cancelBuild(@Param('queueId') queueId: string, @CurrentUser('id') userId: string) {
    return this.shipyardService.cancelBuild(queueId, userId);
  }
}
