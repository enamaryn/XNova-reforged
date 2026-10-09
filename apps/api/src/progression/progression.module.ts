import { Global, Module } from "@nestjs/common";
import { ProgressionService } from "./progression.service";
import { ProgressionController } from "./progression.controller";
@Global()
@Module({
  providers: [ProgressionService],
  exports: [ProgressionService],
  controllers: [ProgressionController],
})
export class ProgressionModule {}
