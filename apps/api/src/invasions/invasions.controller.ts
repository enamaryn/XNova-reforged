import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { GAME_CONSTANTS } from '@xnova/game-config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { InvasionService } from './invasions.service';

class StartInvasionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(GAME_CONSTANTS.MAX_GALAXIES)
  galaxy?: number;
}

/** État des invasions : lisible par tout joueur connecté. */
@UseGuards(JwtAuthGuard)
@Controller('invasions')
export class InvasionController {
  constructor(private readonly invasions: InvasionService) {}

  @Get()
  state(@CurrentUser('id') userId: string) {
    return this.invasions.state(userId);
  }
}

/** Console d'administration : réglages, lancement et annulation d'une invasion. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/invasions')
export class AdminInvasionController {
  constructor(private readonly invasions: InvasionService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  overview() {
    return this.invasions.adminOverview();
  }

  /** Le corps est validé en entier par `parseInvasionConfig` (aucune valeur n'est corrigée en silence). */
  @Put('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Body() body: unknown, @CurrentUser('id') actorId: string) {
    return this.invasions.updateConfig(actorId, body);
  }

  @Delete('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  reset(@CurrentUser('id') actorId: string) {
    return this.invasions.resetConfig(actorId);
  }

  @Post('start')
  @Roles('ADMIN', 'SUPER_ADMIN')
  start(@Body() dto: StartInvasionDto, @CurrentUser('id') actorId: string) {
    return this.invasions.adminStart(actorId, dto);
  }

  @Post('cancel')
  @Roles('ADMIN', 'SUPER_ADMIN')
  cancel(@CurrentUser('id') actorId: string) {
    return this.invasions.adminCancel(actorId);
  }
}
