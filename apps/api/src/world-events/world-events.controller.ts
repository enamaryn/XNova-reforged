import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { LaunchCustomEventDto, LaunchTemplateEventDto, SetAutoDto } from './dto/world-events.dto';
import { WorldEventsService } from './world-events.service';

/** Événements en cours : lisibles par tout joueur connecté (bannière). */
@UseGuards(JwtAuthGuard)
@Controller('world-events')
export class WorldEventsController {
  constructor(private readonly events: WorldEventsService) {}

  @Get('active')
  active() {
    return this.events.active();
  }
}

/** Console d'administration : calendrier, rappels, lancement, arrêt, case « automatique ». */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/world-events')
export class AdminWorldEventsController {
  constructor(private readonly events: WorldEventsService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  overview() {
    return this.events.adminOverview();
  }

  @Post('launch-template')
  @Roles('ADMIN', 'SUPER_ADMIN')
  launchTemplate(@Body() dto: LaunchTemplateEventDto, @CurrentUser('id') actorId: string) {
    return this.events.launchTemplate(actorId, dto);
  }

  @Post('launch-custom')
  @Roles('ADMIN', 'SUPER_ADMIN')
  launchCustom(@Body() dto: LaunchCustomEventDto, @CurrentUser('id') actorId: string) {
    return this.events.launchCustom(actorId, dto);
  }

  @Put('templates/:templateId/auto')
  @Roles('ADMIN', 'SUPER_ADMIN')
  setAuto(@Param('templateId') templateId: string, @Body() dto: SetAutoDto, @CurrentUser('id') actorId: string) {
    return this.events.setAuto(actorId, templateId, dto.auto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  end(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') actorId: string) {
    return this.events.end(actorId, id);
  }
}
