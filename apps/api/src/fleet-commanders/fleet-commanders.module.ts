import { Global, Module } from '@nestjs/common';
import { FleetCommandersController } from './fleet-commanders.controller';
import { FleetCommandersService } from './fleet-commanders.service';

/** Global : le module flotte lit et assigne les commandants à l'envoi. */
@Global()
@Module({
  controllers: [FleetCommandersController],
  providers: [FleetCommandersService],
  exports: [FleetCommandersService],
})
export class FleetCommandersModule {}
