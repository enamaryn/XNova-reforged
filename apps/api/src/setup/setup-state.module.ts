import { Module } from '@nestjs/common';
import { SetupStateService } from './setup-state.service';

@Module({
  providers: [SetupStateService],
  exports: [SetupStateService],
})
export class SetupStateModule {}
