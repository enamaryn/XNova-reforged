import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateAllianceDto } from './dto/create-alliance.dto';
import { InviteAllianceDto } from './dto/invite-alliance.dto';

@Injectable()
export class AlliancesService {
  constructor(private readonly database: DatabaseService) {}

  async getAlliance(allianceId: string) {
    const alliance = await this.database.alliance.findUnique({
      where: { id: allianceId },
      select: {
        id: true,
        tag: true,
        name: true,
        description: true,
        founderId: true,
        createdAt: true,
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            rank: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                username: true,
                points: true,
                rank: true,
              },
            },
          },
        },
      },
    });

    if (!alliance) {
      throw new NotFoundException('Alliance introuvable');
    }

    return alliance;
  }

  async getMyAlliance(userId: string) {
    const membership = await this.database.allianceMember.findUnique({
      where: { userId },
      select: {
        id: true,
        rank: true,
        joinedAt: true,
        alliance: {
          select: {
            id: true,
            tag: true,
            name: true,
            description: true,
            founderId: true,
            createdAt: true,
            members: {
              orderBy: { joinedAt: 'asc' },
              select: {
                id: true,
                rank: true,
                joinedAt: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    points: true,
                    rank: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return membership;
  }

  async createAlliance(userId: string, dto: CreateAllianceDto) {
    const existingMembership = await this.database.allianceMember.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingMembership) {
      throw new BadRequestException('Vous etes deja dans une alliance');
    }

    const normalizedTag = dto.tag.trim().toUpperCase();

    const existingAlliance = await this.database.alliance.findUnique({
      where: { tag: normalizedTag },
      select: { id: true },
    });

    if (existingAlliance) {
      throw new BadRequestException('Ce tag est deja utilise');
    }

    const [alliance] = await this.database.$transaction([
      this.database.alliance.create({
        data: {
          tag: normalizedTag,
          name: dto.name,
          description: dto.description,
          founderId: userId,
        },
        select: {
          id: true,
          tag: true,
          name: true,
          description: true,
          founderId: true,
          createdAt: true,
        },
      }),
      this.database.allianceMember.create({
        data: {
          rank: 'founder',
          user: {
            connect: {
              id: userId,
            },
          },
          alliance: {
            connect: {
              tag: normalizedTag,
            },
          },
        },
      }),
    ]);

    return alliance;
  }

  async inviteMember(userId: string, allianceId: string, dto: InviteAllianceDto) {
    const membership = await this.database.allianceMember.findUnique({
      where: { userId },
      select: { allianceId: true },
    });

    if (!membership || membership.allianceId !== allianceId) {
      throw new BadRequestException('Vous n avez pas acces a cette alliance');
    }

    const target = await this.database.user.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true },
    });

    if (!target) {
      throw new NotFoundException('Joueur introuvable');
    }

    const targetMembership = await this.database.allianceMember.findUnique({
      where: { userId: target.id },
      select: { id: true },
    });

    if (targetMembership) {
      throw new BadRequestException('Le joueur est deja dans une alliance');
    }

    const alliance = await this.database.alliance.findUnique({
      where: { id: allianceId },
      select: { id: true, tag: true, name: true },
    });

    if (!alliance) {
      throw new NotFoundException('Alliance introuvable');
    }

    await this.database.message.create({
      data: {
        fromId: userId,
        toId: target.id,
        subject: `Invitation alliance [${alliance.tag}]`,
        body: `Vous etes invite a rejoindre l alliance ${alliance.name}.\n\nUtilisez l onglet Alliance pour rejoindre (ID: ${alliance.id}).`,
      },
    });

    return { success: true };
  }

  async joinAlliance(userId: string, allianceId: string) {
    const membership = await this.database.allianceMember.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (membership) {
      throw new BadRequestException('Vous etes deja dans une alliance');
    }

    const alliance = await this.database.alliance.findUnique({
      where: { id: allianceId },
      select: { id: true },
    });

    if (!alliance) {
      throw new NotFoundException('Alliance introuvable');
    }

    return this.database.allianceMember.create({
      data: {
        userId,
        allianceId,
        rank: 'member',
      },
      select: {
        id: true,
        rank: true,
        joinedAt: true,
      },
    });
  }

  async leaveAlliance(userId: string, allianceId: string) {
    const membership = await this.database.allianceMember.findUnique({
      where: { userId },
      select: { id: true, allianceId: true },
    });

    if (!membership || membership.allianceId !== allianceId) {
      throw new NotFoundException('Alliance introuvable');
    }

    const alliance = await this.database.alliance.findUnique({
      where: { id: allianceId },
      select: { founderId: true },
    });

    if (!alliance) {
      throw new NotFoundException('Alliance introuvable');
    }

    if (alliance.founderId === userId) {
      throw new BadRequestException('Le fondateur ne peut pas quitter');
    }

    await this.database.allianceMember.delete({ where: { userId } });
    return { success: true };
  }
}
