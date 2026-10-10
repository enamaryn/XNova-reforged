import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  calculateProgression,
  BUILDING_FIELDS,
  evaluateOnboarding,
  type OnboardingSnapshot,
} from "@xnova/game-config";
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

  /**
   * Objectifs débutants : état réel du joueur (toutes planètes) évalué par `evaluateOnboarding`.
   * Lecture seule, une seule transaction cohérente.
   */
  async getOnboarding(userId: string) {
    return this.database.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            planets: {
              select: {
                metalMine: true,
                crystalMine: true,
                deuteriumMine: true,
                solarPlant: true,
                researchLab: true,
                shipyard: true,
                energyUsed: true,
                energyAvailable: true,
                ships: { select: { amount: true } },
              },
            },
            technologies: { select: { level: true } },
            fleets: { select: { status: true, ships: true } },
          },
        });
        if (!user) throw new NotFoundException("Joueur introuvable");

        const [pendingResearch, spyReports, combatReports] = await Promise.all([
          tx.researchQueue.count({ where: { userId, completed: false } }),
          tx.spyReport.count({ where: { attackerId: userId } }),
          tx.combatReport.count({ where: { attackerId: userId } }),
        ]);

        const max = (pick: (planet: (typeof user.planets)[number]) => number) =>
          user.planets.reduce((best, planet) => Math.max(best, pick(planet)), 0);
        const sumShips = (ships: unknown) =>
          Object.values((ships ?? {}) as Record<string, number>).reduce(
            (total, amount) => total + (Number(amount) || 0),
            0,
          );
        const inFlight = user.fleets.filter((f) => f.status !== "completed");

        const snapshot: OnboardingSnapshot = {
          buildings: {
            metalMine: max((p) => p.metalMine),
            crystalMine: max((p) => p.crystalMine),
            deuteriumMine: max((p) => p.deuteriumMine),
            solarPlant: max((p) => p.solarPlant),
            researchLab: max((p) => p.researchLab),
            shipyard: max((p) => p.shipyard),
          },
          energyBalanced: user.planets.some(
            (p) => p.energyUsed > 0 && p.energyAvailable >= p.energyUsed,
          ),
          researchStarted:
            user.technologies.filter((t) => t.level >= 1).length + pendingResearch,
          ships:
            user.planets.reduce(
              (total, planet) =>
                total + planet.ships.reduce((sum, ship) => sum + ship.amount, 0),
              0,
            ) + inFlight.reduce((total, fleet) => total + sumShips(fleet.ships), 0),
          fleetsSent: user.fleets.length,
          missionResults:
            spyReports +
            combatReports +
            user.fleets.filter((f) => f.status === "returning" || f.status === "completed")
              .length,
        };
        return evaluateOnboarding(snapshot);
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
