import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketCronService } from './market-cron.service';
import { MarketService } from './market.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, MarketCronService],
})
export class MarketModule {}
