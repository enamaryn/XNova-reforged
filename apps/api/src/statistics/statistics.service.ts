import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly database: DatabaseService) {}

  async getOverview(userId: string) {
    const [user, topPlayers, alliances] = await Promise.all([
      this.database.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          points: true,
          rank: true,
          createdAt: true,
          allianceMember: {
            select: {
              alliance: {
                select: {
                  id: true,
                  tag: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              planets: true,
            },
          },
        },
      }),
      this.database.user.findMany({
        orderBy: { points: 'desc' },
        take: 20,
        select: {
          id: true,
          username: true,
          points: true,
          rank: true,
        },
      }),
      this.database.alliance.findMany({
        select: {
          id: true,
          tag: true,
          name: true,
          members: {
            select: {
              user: {
                select: {
                  points: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const topAlliances = alliances
      .map((alliance) => {
        const members = alliance.members.length;
        const points = alliance.members.reduce(
          (total, member) => total + member.user.points,
          0,
        );

        return {
          id: alliance.id,
          tag: alliance.tag,
          name: alliance.name,
          members,
          points,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    return {
      personal: {
        id: user.id,
        username: user.username,
        points: user.points,
        rank: user.rank,
        createdAt: user.createdAt,
        planets: user._count.planets,
        alliance: user.allianceMember?.alliance ?? null,
      },
      topPlayers,
      topAlliances,
    };
  }
}
