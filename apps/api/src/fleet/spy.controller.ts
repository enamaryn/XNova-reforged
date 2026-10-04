import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SpyService } from './spy.service';

@UseGuards(JwtAuthGuard)
@Controller('spy-reports')
export class SpyController {
  constructor(private readonly spyService: SpyService) {}

  @Get()
  getReports(@CurrentUser('id') userId: string) {
    return this.spyService.getReports(userId);
  }

  @Get(':reportId')
  getReport(@Param('reportId') reportId: string, @CurrentUser('id') userId: string) {
    return this.spyService.getReport(reportId, userId);
  }
}
