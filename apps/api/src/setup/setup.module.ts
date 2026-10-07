import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ServerConfigModule } from '../server-config/server-config.module';
import { SetupController } from './setup.controller';
import { SetupGuard } from './setup.guard';
import { SetupService } from './setup.service';
import { SetupStateModule } from './setup-state.module';

@Module({
  imports: [AuthModule, MailModule, ServerConfigModule, SetupStateModule],
  controllers: [SetupController],
  providers: [SetupService, SetupGuard],
})
export class SetupModule {}
