import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JumpDto, PhalanxScanDto } from './dto/moon.dto';
import { MoonsService } from './moons.service';

@UseGuards(JwtAuthGuard)
@Controller('moons')
export class MoonsController {
  constructor(private readonly moons: MoonsService) {}

  @Get(':moonId')
  overview(@Param('moonId') moonId: string, @CurrentUser('id') userId: string) {
    return this.moons.overview(moonId, userId);
  }

  @Post(':moonId/phalanx')
  scan(@Param('moonId') moonId: string, @Body() dto: PhalanxScanDto, @CurrentUser('id') userId: string) {
    return this.moons.scan(moonId, dto, userId);
  }

  @Post(':moonId/jump')
  jump(@Param('moonId') moonId: string, @Body() dto: JumpDto, @CurrentUser('id') userId: string) {
    return this.moons.jump(moonId, dto, userId);
  }
}
