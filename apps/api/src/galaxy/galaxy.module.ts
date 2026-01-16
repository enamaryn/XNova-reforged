import { Module } from '@nestjs/common';
import { GalaxyController } from './galaxy.controller';
import { GalaxyService } from './galaxy.service';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [ServerConfigModule],
  controllers: [GalaxyController],
  providers: [GalaxyService],
})
export class GalaxyModule {}
