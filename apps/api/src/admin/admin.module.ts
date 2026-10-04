import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../database/database.module';
import { GameEventsModule } from '../game-events/game-events.module';
import { MailModule } from '../mail/mail.module';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [DatabaseModule, ServerConfigModule, GameEventsModule, MailModule],
  controllers: [AdminController],
  providers: [AdminService, Reflector],
})
export class AdminModule {}
