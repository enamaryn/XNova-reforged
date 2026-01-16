import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('config')
  getConfig() {
    return this.adminService.getConfig();
  }

  @Put('config')
  updateConfig(
    @Body() dto: UpdateConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.updateConfig(userId, dto);
  }
}
