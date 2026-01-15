import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CombatService } from './combat.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Get()
  getReports(@CurrentUser('id') userId: string) {
    return this.combatService.getReports(userId);
  }

  @Get(':reportId')
  getReport(@Param('reportId') reportId: string, @CurrentUser('id') userId: string) {
    return this.combatService.getReportById(reportId, userId);
  }
}
