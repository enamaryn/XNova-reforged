import { Module } from '@nestjs/common';
import { ShipyardController } from './shipyard.controller';
import { ShipyardCronService } from './shipyard-cron.service';
import { ShipyardService } from './shipyard.service';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [ServerConfigModule],
  controllers: [ShipyardController],
  providers: [ShipyardService, ShipyardCronService],
})
export class ShipyardModule {}
