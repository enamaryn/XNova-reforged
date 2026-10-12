import { Global, Module } from '@nestjs/common';
import { ServerConfigModule } from '../server-config/server-config.module';
import { OfficersController } from './officers.controller';
import { OfficersService } from './officers.service';

/** Global : les modules bâtiments, recherche, flotte et espionnage lisent les bonus des officiers. */
@Global()
@Module({
  imports: [ServerConfigModule],
  controllers: [OfficersController],
  providers: [OfficersService],
  exports: [OfficersService],
})
export class OfficersModule {}
