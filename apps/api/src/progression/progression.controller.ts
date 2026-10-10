import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ProgressionService } from "./progression.service";
@UseGuards(JwtAuthGuard)
@Controller("progression")
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}
  @Get("onboarding")
  onboarding(@CurrentUser("id") userId: string) {
    return this.progression.getOnboarding(userId);
  }
  @Get()
  get(@CurrentUser("id") userId: string) {
    return this.progression.get(userId);
  }
}
