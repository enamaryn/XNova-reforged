import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MonitoringService, type Metric, type AggregatedMetric } from './monitoring.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('metrics')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  getMetrics(): Record<string, AggregatedMetric> {
    return this.monitoring.getAggregatedMetrics();
  }

  @Get('raw')
  @Roles('SUPER_ADMIN')
  getRawMetrics(): Metric[] {
    return this.monitoring.getMetrics();
  }
}
