import { Module } from '@nestjs/common';
import { GalaxyController } from './galaxy.controller';
import { GalaxyService } from './galaxy.service';

@Module({
  controllers: [GalaxyController],
  providers: [GalaxyService],
})
export class GalaxyModule {}
