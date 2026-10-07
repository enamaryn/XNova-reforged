import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { UpdateConfigDto } from '../admin/dto/update-config.dto';
import { UpdateSmtpDto } from '../admin/dto/update-smtp.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { RateLimit, RateLimitGuard } from '../common/security/rate-limit.guard';
import { SetupSmtpTestDto } from './dto/setup.dto';
import { SetupGuard } from './setup.guard';
import { SetupService } from './setup.service';
import { SetupStateService } from './setup-state.service';

/**
 * Parcours d'installation du serveur (SETUP-01). Seule `GET /setup/status` est publique (l'interface sait
 * ainsi s'il faut proposer le parcours). Le reste exige le code d'installation affiché dans le terminal du
 * serveur et disparaît (404) quand l'installation est terminée.
 */
@Controller('setup')
@UseGuards(RateLimitGuard)
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    private readonly state: SetupStateService,
  ) {}

  @Get('status')
  @RateLimit('setup')
  async status() {
    return { setupRequired: !(await this.state.isCompleted()) };
  }

  @Get('state')
  @RateLimit('setup')
  @UseGuards(SetupGuard)
  getState() {
    return this.setup.getState();
  }

  @Put('smtp')
  @RateLimit('setup')
  @UseGuards(SetupGuard)
  saveSmtp(@Body() dto: UpdateSmtpDto) {
    return this.setup.saveSmtp(dto);
  }

  @Post('smtp/test')
  @RateLimit('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SetupGuard)
  testSmtp(@Body() dto: SetupSmtpTestDto) {
    return this.setup.testSmtp(dto.to);
  }

  @Put('settings')
  @RateLimit('setup')
  @UseGuards(SetupGuard)
  saveSettings(@Body() dto: UpdateConfigDto) {
    return this.setup.saveSettings(dto);
  }

  @Post('admin')
  @RateLimit('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SetupGuard)
  createAdmin(@Body() dto: RegisterDto) {
    return this.setup.createAdmin(dto);
  }

  @Post('admin/resend')
  @RateLimit('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SetupGuard)
  resendAdmin() {
    return this.setup.resendAdminEmail();
  }
}
