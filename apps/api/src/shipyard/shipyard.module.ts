import { Module } from '@nestjs/common';
import { ShipyardController } from './shipyard.controller';
import { ShipyardCronService } from './shipyard-cron.service';
import { ShipyardService } from './shipyard.service';

@Module({
  controllers: [ShipyardController],
  providers: [ShipyardService, ShipyardCronService],
})
export class ShipyardModule {}
