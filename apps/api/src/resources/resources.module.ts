import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { ResourcesCronService } from './resources-cron.service';
import { GameEventsModule } from '../game-events/game-events.module';

@Module({
  imports: [GameEventsModule], // Import pour utiliser GameEventsGateway
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourcesCronService],
  exports: [ResourcesService], // Export pour utilisation dans d'autres modules
})
export class ResourcesModule {}
