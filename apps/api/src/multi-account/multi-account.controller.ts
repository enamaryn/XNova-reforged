import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ExemptionDto, RemoveExemptionDto } from './dto/multi-account.dto';
import { MultiAccountService } from './multi-account.service';

/** Comptes liés, exemptions et réglages : réservés aux administrateurs (adresses IP et emails visibles). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/multi-account')
export class MultiAccountController {
  constructor(private readonly multiAccount: MultiAccountService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  overview() {
    return this.multiAccount.adminOverview();
  }

  /** Le corps est validé en entier (aucune valeur n'est corrigée en silence). */
  @Put('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateConfig(@Body() body: unknown, @CurrentUser('id') actorId: string) {
    return this.multiAccount.updateConfig(actorId, body);
  }

  @Delete('config')
  @Roles('ADMIN', 'SUPER_ADMIN')
  resetConfig(@CurrentUser('id') actorId: string) {
    return this.multiAccount.resetConfig(actorId);
  }

  @Post('exemptions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  addExemption(@Body() dto: ExemptionDto, @CurrentUser('id') actorId: string) {
    return this.multiAccount.addExemption(actorId, dto.userA, dto.userB, dto.reason);
  }

  @Delete('exemptions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  removeExemption(@Body() dto: RemoveExemptionDto, @CurrentUser('id') actorId: string) {
    return this.multiAccount.removeExemption(actorId, dto.userA, dto.userB);
  }
}
