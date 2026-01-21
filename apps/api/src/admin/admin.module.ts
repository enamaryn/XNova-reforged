import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../database/database.module';
import { ServerConfigModule } from '../server-config/server-config.module';

@Module({
  imports: [DatabaseModule, ServerConfigModule],
  controllers: [AdminController],
  providers: [AdminService, Reflector],
})
export class AdminModule {}
