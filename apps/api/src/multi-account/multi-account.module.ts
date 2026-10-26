import { Global, Module } from '@nestjs/common';
import { MultiAccountController } from './multi-account.controller';
import { MultiAccountCronService } from './multi-account-cron.service';
import { MultiAccountService } from './multi-account.service';

/** Global : inscription, connexion, marché et flottes contrôlent les liens entre comptes. */
@Global()
@Module({
  controllers: [MultiAccountController],
  providers: [MultiAccountService, MultiAccountCronService],
  exports: [MultiAccountService],
})
export class MultiAccountModule {}
