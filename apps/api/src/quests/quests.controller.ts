import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClaimQuestDto } from './dto/quest.dto';
import { QuestsService } from './quests.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get('quests')
  list(@CurrentUser('id') userId: string) {
    return this.quests.list(userId);
  }

  @Post('quests/:questId/claim')
  claim(@Param('questId') questId: string, @Body() dto: ClaimQuestDto, @CurrentUser('id') userId: string) {
    return this.quests.claim(userId, questId, dto.planetId, dto.periodKey);
  }

  @Get('achievements')
  achievements(@CurrentUser('id') userId: string) {
    return this.quests.achievements(userId);
  }
}
