import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import {
  progressionInclude,
  progressionOf,
} from "../progression/progression.service";

@Injectable()
export class StatisticsService {
  constructor(private readonly database: DatabaseService) {}

  async getOverview(userId: string) {
    // One repeatable snapshot avoids counting a deployed fleet both in orbit and on its destination.
    return this.database.$transaction(
      async (tx) => {
        const users = await tx.user.findMany({
          include: {
            ...progressionInclude,
            allianceMember: { include: { alliance: true } },
          },
        });
        const ranked = users
          .map((user) => ({ user, progression: progressionOf(user) }))
          .sort(
            (a, b) =>
              b.progression.power - a.progression.power ||
              a.user.createdAt.getTime() - b.user.createdAt.getTime() ||
              a.user.id.localeCompare(b.user.id),
          );
        const index = ranked.findIndex((row) => row.user.id === userId);
        if (index < 0) throw new NotFoundException("Utilisateur introuvable");
        const { user, progression } = ranked[index];
        const alliances = new Map<
          string,
          {
            id: string;
            tag: string;
            name: string;
            members: number;
            points: number;
          }
        >();
        for (const row of ranked) {
          const alliance = row.user.allianceMember?.alliance;
          if (!alliance) continue;
          const entry = alliances.get(alliance.id) ?? {
            id: alliance.id,
            tag: alliance.tag,
            name: alliance.name,
            members: 0,
            points: 0,
          };
          entry.members++;
          entry.points += row.progression.power;
          alliances.set(alliance.id, entry);
        }
        return {
          personal: {
            id: user.id,
            username: user.username,
            points: progression.power,
            rank: index + 1,
            createdAt: user.createdAt,
            planets: user.planets.filter((p) => p.planetType !== "moon").length,
            alliance: user.allianceMember?.alliance
              ? {
                  id: user.allianceMember.alliance.id,
                  tag: user.allianceMember.alliance.tag,
                  name: user.allianceMember.alliance.name,
                }
              : null,
            progression,
          },
          topPlayers: ranked
            .slice(0, 20)
            .map((row, i) => ({
              id: row.user.id,
              username: row.user.username,
              points: row.progression.power,
              rank: i + 1,
              commanderLevel: row.progression.commanderLevel,
            })),
          topAlliances: [...alliances.values()]
            .sort((a, b) => b.points - a.points || a.id.localeCompare(b.id))
            .slice(0, 10),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
