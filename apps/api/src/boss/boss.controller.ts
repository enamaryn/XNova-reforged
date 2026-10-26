import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { GAME_CONSTANTS } from '@xnova/game-config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BossService } from './boss.service';

class SpawnBossDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(GAME_CONSTANTS.MAX_GALAXIES)
  galaxy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(GAME_CONSTANTS.MAX_SYSTEMS)
  system?: number;
}

/** État du boss galactique : lisible par tout joueur connecté. */
@UseGuards(JwtAuthGuard)
@Controller('boss')
export class BossController {
  constructor(private readonly boss: BossService) {}

  @Get()
  state(@CurrentUser('id') userId: string) {
    return this.boss.state(userId);
  }
}

/** Console d'administration : réglages, apparition et retrait du boss. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/boss')
export class AdminBossController {
  constructor(private readonly boss: BossService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  overview() {
    return this.boss.adminOverview();
  }

  /** Le corps est validé en entier par `parseBossConfig` (aucune valeur n'est corrigée en silence). */
  @Put('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Body() body: unknown, @CurrentUser('id') actorId: string) {
    return this.boss.updateConfig(actorId, body);
  }

  @Delete('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  reset(@CurrentUser('id') actorId: string) {
    return this.boss.resetConfig(actorId);
  }

  @Post('spawn')
  @Roles('ADMIN', 'SUPER_ADMIN')
  spawn(@Body() dto: SpawnBossDto, @CurrentUser('id') actorId: string) {
    return this.boss.adminSpawn(actorId, dto);
  }

  @Post('despawn')
  @Roles('ADMIN', 'SUPER_ADMIN')
  despawn(@CurrentUser('id') actorId: string) {
    return this.boss.adminDespawn(actorId);
  }
}
