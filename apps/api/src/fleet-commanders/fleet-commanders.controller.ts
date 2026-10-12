import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecruitCommanderDto } from './dto/commander.dto';
import { FleetCommandersService } from './fleet-commanders.service';

@UseGuards(JwtAuthGuard)
@Controller('fleet-commanders')
export class FleetCommandersController {
  constructor(private readonly commanders: FleetCommandersService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.commanders.list(userId);
  }

  @Post()
  recruit(@Body() dto: RecruitCommanderDto, @CurrentUser('id') userId: string) {
    return this.commanders.recruit(userId, dto.name, dto.planetId);
  }

  @Post(':id/skills/:skill')
  spend(@Param('id') id: string, @Param('skill') skill: string, @CurrentUser('id') userId: string) {
    return this.commanders.spendPoint(userId, id, skill);
  }

  @Delete(':id')
  dismiss(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.commanders.dismiss(userId, id);
  }
}
