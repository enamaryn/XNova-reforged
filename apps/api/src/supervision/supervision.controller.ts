import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { IncidentStatusDto, PurgeDto, SentryTestDto, UpdateSupervisionDto } from './dto';
import { IncidentQueryService, toCsv, type IncidentFilters, type Period } from './incident-query.service';
import { IncidentService } from './incident.service';
import { SupervisionService } from './supervision.service';

const toNumber = (value: string | undefined) => (value === undefined || value === '' ? undefined : Number(value));

function filtersOf(q: Record<string, string | undefined>): IncidentFilters {
  const page = toNumber(q.page);
  const pageSize = toNumber(q.pageSize);
  if ((page !== undefined && !Number.isFinite(page)) || (pageSize !== undefined && !Number.isFinite(pageSize))) {
    throw new BadRequestException('Pagination invalide');
  }
  return {
    period: (q.period as Period | undefined) || undefined,
    level: q.level || undefined,
    source: q.source || undefined,
    status: q.status || undefined,
    q: q.q || undefined,
    sort: q.sort === 'occurrences' ? 'occurrences' : 'lastSeen',
    page,
    pageSize,
  };
}

/**
 * Console de supervision : lecture pour ADMIN et SUPER_ADMIN ; toute modification (statut d'incident, paramètres,
 * Sentry, purge) réservée au SUPER_ADMIN et consignée dans le journal d'audit sans jamais exposer de secret.
 */
@Controller('admin/supervision')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupervisionController {
  constructor(
    private readonly service: SupervisionService,
    private readonly query: IncidentQueryService,
    private readonly incidents: IncidentService,
  ) {}

  @Get('overview')
  @Roles('ADMIN', 'SUPER_ADMIN')
  overview() {
    return this.service.overview();
  }

  @Get('incidents')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async list(@Query() q: Record<string, string | undefined>) {
    await this.incidents.flush();
    return this.query.list(filtersOf(q));
  }

  @Get('incidents/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.query.get(id);
  }

  @Patch('incidents/:id/status')
  @Roles('SUPER_ADMIN')
  async setStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: IncidentStatusDto, @CurrentUser('id') actorId: string) {
    return this.service.setIncidentStatus(id, dto.status, actorId);
  }

  @Get('export')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Header('Cache-Control', 'no-store')
  async export(@Query() q: Record<string, string | undefined>, @Res({ passthrough: true }) res: Response) {
    await this.incidents.flush();
    const rows = await this.query.export(filtersOf(q));
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="incidents-${stamp}.csv"`);
      return toCsv(rows as unknown as Array<Record<string, unknown>>);
    }
    res.setHeader('Content-Disposition', `attachment; filename="incidents-${stamp}.json"`);
    return { exportedAt: new Date().toISOString(), count: rows.length, incidents: rows };
  }

  @Get('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getConfig() {
    return this.service.getConfig();
  }

  @Put('config')
  @Roles('SUPER_ADMIN')
  updateConfig(@Body() dto: UpdateSupervisionDto, @CurrentUser('id') actorId: string) {
    return this.service.updateConfig(actorId, dto);
  }

  @Delete('sentry')
  @Roles('SUPER_ADMIN')
  clearSentry(@CurrentUser('id') actorId: string) {
    return this.service.clearSentry(actorId);
  }

  @Post('sentry/test')
  @Roles('SUPER_ADMIN')
  testSentry(@Body() dto: SentryTestDto, @CurrentUser('id') actorId: string) {
    return this.service.testSentry(actorId, dto.dsnApi);
  }

  @Post('purge')
  @Roles('SUPER_ADMIN')
  purge(@Body() dto: PurgeDto, @CurrentUser('id') actorId: string) {
    if (dto.confirm !== true) throw new BadRequestException('Confirmation requise pour purger les incidents');
    return this.service.purge(actorId, dto.olderThanDays ?? 0, dto.onlyClosed ?? false);
  }
}
