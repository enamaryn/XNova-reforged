import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly database: DatabaseService) {}

  async getInbox(userId: string) {
    return this.database.message.findMany({
      where: { toId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        subject: true,
        body: true,
        read: true,
        createdAt: true,
        from: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async getMessage(userId: string, messageId: string) {
    const message = await this.database.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        subject: true,
        body: true,
        read: true,
        createdAt: true,
        fromId: true,
        toId: true,
        from: {
          select: {
            id: true,
            username: true,
          },
        },
        to: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!message || (message.toId !== userId && message.fromId !== userId)) {
      throw new NotFoundException('Message introuvable');
    }

    if (message.toId === userId && !message.read) {
      await this.database.message.update({
        where: { id: messageId },
        data: { read: true },
      });
    }

    return message;
  }

  async sendMessage(fromId: string, dto: SendMessageDto) {
    const recipient = await this.database.user.findUnique({
      where: { username: dto.toUsername },
      select: { id: true },
    });

    if (!recipient) {
      throw new NotFoundException('Destinataire introuvable');
    }

    if (recipient.id === fromId) {
      throw new BadRequestException('Impossible de se contacter soi-meme');
    }

    return this.database.message.create({
      data: {
        fromId,
        toId: recipient.id,
        subject: dto.subject,
        body: dto.body,
      },
      select: {
        id: true,
        subject: true,
        body: true,
        read: true,
        createdAt: true,
      },
    });
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.database.message.findUnique({
      where: { id: messageId },
      select: { id: true, toId: true },
    });

    if (!message || message.toId !== userId) {
      throw new NotFoundException('Message introuvable');
    }

    await this.database.message.delete({ where: { id: messageId } });
    return { success: true };
  }
}
