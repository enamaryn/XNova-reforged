import { Module } from '@nestjs/common';
import { ServerConfigModule } from '../server-config/server-config.module';
import { AdminNpcTradeController, NpcTradeController } from './npc-trade.controller';
import { NpcTradeService } from './npc-trade.service';

@Module({
  imports: [ServerConfigModule],
  controllers: [NpcTradeController, AdminNpcTradeController],
  providers: [NpcTradeService],
})
export class NpcTradeModule {}
