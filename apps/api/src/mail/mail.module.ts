import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ServerConfigModule } from '../server-config/server-config.module';
import { MailService } from './mail.service';
import { SmtpConfigService } from './smtp-config.service';

@Module({
  imports: [DatabaseModule, ServerConfigModule],
  providers: [SmtpConfigService, MailService],
  exports: [SmtpConfigService, MailService],
})
export class MailModule {}
