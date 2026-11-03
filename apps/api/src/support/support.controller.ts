import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Headers, UseGuards } from '@nestjs/common';
import { SUPPORT_STATUSES, type SupportStatus } from '@xnova/game-config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RateLimit, RateLimitGuard } from '../common/security/rate-limit.guard';
import { CreateSupportReportDto, UpdateSupportStatusDto } from './dto/support.dto';
import { SupportService } from './support.service';

/** Signalements des joueurs connectés. */
@UseGuards(JwtAuthGuard, RateLimitGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('reports')
  @RateLimit('support')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateSupportReportDto,
    @CurrentUser('id') userId: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.support.create(userId, dto, userAgent);
  }

  @Get('reports/mine')
  mine(@CurrentUser('id') userId: string) {
    return this.support.mine(userId);
  }
}

/** Console d'administration : lecture et traitement des signalements. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  list(@Query('status') status?: string, @Query('page') page?: string) {
    const filter = (SUPPORT_STATUSES as readonly string[]).includes(status ?? '') ? (status as SupportStatus) : undefined;
    const number = Math.max(1, Math.min(1000, Math.floor(Number(page)) || 1));
    return this.support.adminList(filter, number);
  }

  @Patch('reports/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.support.setStatus(actorId, id, dto.status);
  }
}
