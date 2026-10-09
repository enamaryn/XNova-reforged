import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { calculateProgression, BUILDING_FIELDS } from "@xnova/game-config";
import { DatabaseService } from "../database/database.service";

export const progressionInclude = {
  planets: { include: { ships: true, defenses: true } },
  technologies: true,
  fleets: { where: { status: { in: ["traveling", "returning", "arrived"] } } },
} satisfies Prisma.UserInclude;
export type ProgressionUser = Prisma.UserGetPayload<{
  include: typeof progressionInclude;
}>;
export function progressionOf(user: ProgressionUser) {
  return calculateProgression({
    planets: user.planets.map((planet) => ({
      buildings: Object.fromEntries(
        Object.values(BUILDING_FIELDS).map((field) => [
          field,
          planet[field as keyof typeof planet] as number,
        ]),
      ),
      planetType: planet.planetType,
      ships: planet.ships,
      defenses: planet.defenses,
    })),
    technologies: user.technologies,
    fleets: user.fleets.map((f) => ({
      ships: f.ships as Record<string, number>,
    })),
  });
}
@Injectable()
export class ProgressionService {
  constructor(private readonly database: DatabaseService) {}
  async get(userId: string, client: Prisma.TransactionClient = this.database) {
    if (client === this.database)
      return this.database.$transaction((tx) => this.get(userId, tx), {
        isolationLevel: "RepeatableRead",
      });
    const user = await client.user.findUnique({
      where: { id: userId },
      include: progressionInclude,
    });
    if (!user) throw new NotFoundException("Joueur introuvable");
    return progressionOf(user);
  }
}
