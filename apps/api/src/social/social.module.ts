import { Module } from '@nestjs/common';
import { AlliancesController } from './alliances.controller';
import { AlliancesService } from './alliances.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController, AlliancesController],
  providers: [MessagesService, AlliancesService],
})
export class SocialModule {}
