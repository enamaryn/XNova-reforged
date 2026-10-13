import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketCronService } from './market-cron.service';
import { MarketService } from './market.service';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [ServerConfigModule],
  controllers: [MarketController],
  providers: [MarketService, MarketCronService],
})
export class MarketModule {}
