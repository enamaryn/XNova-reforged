import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('inbox')
  getInbox(@CurrentUser('id') userId: string) {
    return this.messagesService.getInbox(userId);
  }

  @Get(':id')
  getMessage(
    @Param('id') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.getMessage(userId, messageId);
  }

  @Post('send')
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.sendMessage(userId, dto);
  }

  @Delete(':id')
  deleteMessage(
    @Param('id') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.deleteMessage(userId, messageId);
  }
}
