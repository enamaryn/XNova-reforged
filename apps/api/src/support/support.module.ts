import { Module } from '@nestjs/common';
import { AdminSupportController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
