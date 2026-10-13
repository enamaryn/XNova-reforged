import { Module } from '@nestjs/common';
import { EventModifiersService } from '../world-events/event-modifiers.service';
import { ServerConfigService } from './server-config.service';

@Module({
  providers: [ServerConfigService, EventModifiersService],
  exports: [ServerConfigService, EventModifiersService],
})
export class ServerConfigModule {}
