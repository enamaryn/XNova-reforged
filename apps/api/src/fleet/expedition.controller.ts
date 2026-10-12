import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExpeditionService } from './expedition.service';

@UseGuards(JwtAuthGuard)
@Controller('expedition-reports')
export class ExpeditionController {
  constructor(private readonly expeditions: ExpeditionService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.expeditions.getReports(userId);
  }

  @Get(':reportId')
  get(@Param('reportId') reportId: string, @CurrentUser('id') userId: string) {
    return this.expeditions.getReport(reportId, userId);
  }
}
