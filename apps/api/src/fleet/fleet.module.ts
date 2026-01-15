import { Module } from '@nestjs/common';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';

@Module({
  controllers: [FleetController],
  providers: [FleetService],
})
export class FleetModule {}
