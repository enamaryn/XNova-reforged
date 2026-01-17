import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { UnbanUserDto } from './dto/unban-user.dto';
import { BoostDevelopmentDto } from './dto/boost-development.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getConfig() {
    return this.adminService.getConfig();
  }

  @Put('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateConfig(
    @Body() dto: UpdateConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.updateConfig(userId, dto);
  }

  @Put('roles')
  @Roles('SUPER_ADMIN')
  updateRole(
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.updateUserRole(userId, dto);
  }

  @Put('boost-development')
  @Roles('SUPER_ADMIN')
  boostDevelopment(
    @Body() dto: BoostDevelopmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.boostUserDevelopment(userId, dto);
  }

  @Put('ban')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  banUser(
    @Body() dto: BanUserDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.banUser(userId, dto);
  }

  @Put('unban')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  unbanUser(
    @Body() dto: UnbanUserDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.unbanUser(userId, dto);
  }

  @Get('audit')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAuditLogs(@Query('limit') limit?: string) {
    return this.adminService.getAuditLogs(limit ? Number(limit) : undefined);
  }

  @Get('ban-logs')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  getBanLogs(@Query('limit') limit?: string) {
    return this.adminService.getBanLogs(limit ? Number(limit) : undefined);
  }
}
