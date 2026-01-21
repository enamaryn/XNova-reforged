import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

const TOP_PLAYERS_CACHE_KEY = 'xnova:stats:top-players';
const TOP_ALLIANCES_CACHE_KEY = 'xnova:stats:top-alliances';
const STATS_CACHE_TTL_SECONDS = 60;

type TopPlayer = {
  id: string;
  username: string;
  points: number;
  rank: number;
};

type TopAlliance = {
  id: string;
  tag: string;
  name: string;
  members: number;
  points: number;
};

@Injectable()
export class StatisticsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(userId: string) {
    const [user, cachedPlayers, cachedAlliances] = await Promise.all([
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
      this.redis.getJson<TopPlayer[]>(TOP_PLAYERS_CACHE_KEY),
      this.redis.getJson<TopAlliance[]>(TOP_ALLIANCES_CACHE_KEY),
    ]);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    let topPlayers = cachedPlayers;
    if (!topPlayers) {
      topPlayers = await this.database.user.findMany({
        orderBy: { points: 'desc' },
        take: 20,
        select: {
          id: true,
          username: true,
          points: true,
          rank: true,
        },
      });
      await this.redis.setJson(TOP_PLAYERS_CACHE_KEY, topPlayers, STATS_CACHE_TTL_SECONDS);
    }

    let topAlliances = cachedAlliances;
    if (!topAlliances) {
      const alliances = await this.database.alliance.findMany({
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
      });

      topAlliances = alliances
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

      await this.redis.setJson(TOP_ALLIANCES_CACHE_KEY, topAlliances, STATS_CACHE_TTL_SECONDS);
    }

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
