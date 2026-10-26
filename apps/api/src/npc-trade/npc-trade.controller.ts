import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BuyShipsDto, ExchangeDto } from './dto/npc-trade.dto';
import { NpcTradeService } from './npc-trade.service';

@UseGuards(JwtAuthGuard)
@Controller('npc-trade')
export class NpcTradeController {
  constructor(private readonly trade: NpcTradeService) {}

  @Get()
  state(@CurrentUser('id') userId: string) {
    return this.trade.state(userId);
  }

  @Post('exchange')
  exchange(@Body() dto: ExchangeDto, @CurrentUser('id') userId: string) {
    return this.trade.exchange(userId, dto);
  }

  @Post('ships')
  buyShips(@Body() dto: BuyShipsDto, @CurrentUser('id') userId: string) {
    return this.trade.buyShips(userId, dto);
  }
}

/** Réglages du marchand : taux, marges, plafonds, saisons, vaisseaux proposés. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/npc-trade')
export class AdminNpcTradeController {
  constructor(private readonly trade: NpcTradeService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  overview() {
    return this.trade.adminOverview();
  }

  /** Le corps est validé en entier par `parseNpcTradeConfig` (aucune valeur n'est corrigée en silence). */
  @Put()
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Body() body: unknown, @CurrentUser('id') actorId: string) {
    return this.trade.updateConfig(actorId, body);
  }

  @Delete()
  @Roles('ADMIN', 'SUPER_ADMIN')
  reset(@CurrentUser('id') actorId: string) {
    return this.trade.resetConfig(actorId);
  }
}
