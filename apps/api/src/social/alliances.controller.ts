import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateAllianceDto } from './dto/create-alliance.dto';
import { InviteAllianceDto } from './dto/invite-alliance.dto';
import { AlliancesService } from './alliances.service';

@UseGuards(JwtAuthGuard)
@Controller('alliances')
export class AlliancesController {
  constructor(private readonly alliancesService: AlliancesService) {}

  @Get('me')
  getMyAlliance(@CurrentUser('id') userId: string) {
    return this.alliancesService.getMyAlliance(userId);
  }

  @Get(':id')
  getAlliance(@Param('id') allianceId: string) {
    return this.alliancesService.getAlliance(allianceId);
  }

  @Post('create')
  createAlliance(
    @Body() dto: CreateAllianceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.alliancesService.createAlliance(userId, dto);
  }

  @Post(':id/invite')
  inviteMember(
    @Param('id') allianceId: string,
    @Body() dto: InviteAllianceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.alliancesService.inviteMember(userId, allianceId, dto);
  }

  @Post(':id/join')
  joinAlliance(
    @Param('id') allianceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.alliancesService.joinAlliance(userId, allianceId);
  }

  @Delete(':id/leave')
  leaveAlliance(
    @Param('id') allianceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.alliancesService.leaveAlliance(userId, allianceId);
  }
}
