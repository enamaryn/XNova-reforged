import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MailService } from './mail.service';
import { SmtpConfigService } from './smtp-config.service';

@Module({
  imports: [DatabaseModule],
  providers: [SmtpConfigService, MailService],
  exports: [SmtpConfigService, MailService],
})
export class MailModule {}
