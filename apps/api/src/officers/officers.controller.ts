import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HireOfficerDto } from './dto/officer.dto';
import { OfficersService } from './officers.service';

@UseGuards(JwtAuthGuard)
@Controller('officers')
export class OfficersController {
  constructor(private readonly officers: OfficersService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.officers.list(userId);
  }

  @Post(':type/hire')
  hire(@Param('type') type: string, @Body() dto: HireOfficerDto, @CurrentUser('id') userId: string) {
    return this.officers.hire(userId, type, dto.planetId);
  }
}
