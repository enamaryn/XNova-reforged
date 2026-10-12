import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LaunchMissilesDto } from './dto/launch-missiles.dto';
import { MissilesService } from './missiles.service';

@UseGuards(JwtAuthGuard)
@Controller('missiles')
export class MissilesController {
  constructor(private readonly missiles: MissilesService) {}

  @Get(':planetId')
  overview(@Param('planetId') planetId: string, @CurrentUser('id') userId: string) {
    return this.missiles.overview(planetId, userId);
  }

  @Post('launch')
  launch(@Body() dto: LaunchMissilesDto, @CurrentUser('id') userId: string) {
    return this.missiles.launch(dto, userId);
  }
}
