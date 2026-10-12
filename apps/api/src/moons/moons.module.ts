import { Module } from '@nestjs/common';
import { ServerConfigModule } from '../server-config/server-config.module';
import { MoonsController } from './moons.controller';
import { MoonsService } from './moons.service';

@Module({
  imports: [ServerConfigModule],
  controllers: [MoonsController],
  providers: [MoonsService],
})
export class MoonsModule {}
