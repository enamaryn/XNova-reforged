import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FleetService } from './fleet.service';
import { SendFleetDto } from './dto/send-fleet.dto';

@UseGuards(JwtAuthGuard)
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('available/:planetId')
  getAvailableShips(
    @Param('planetId') planetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.fleetService.getAvailableShips(planetId, userId);
  }

  @Get('active')
  getActiveFleets(@CurrentUser('id') userId: string) {
    return this.fleetService.getActiveFleets(userId);
  }

  @Post('send')
  sendFleet(@Body() dto: SendFleetDto, @CurrentUser('id') userId: string) {
    return this.fleetService.sendFleet(dto, userId);
  }

  @Delete(':fleetId')
  recallFleet(@Param('fleetId') fleetId: string, @CurrentUser('id') userId: string) {
    return this.fleetService.recallFleet(fleetId, userId);
  }
}
