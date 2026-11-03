import { Prisma } from '@prisma/client';
import { SHIPS, bossHealthRatio, fleetValue, shipTotal } from '@xnova/game-config';
import { simulateCombat } from '@xnova/game-engine';
import type { DatabaseService } from '../database/database.service';

/** Combat et arrivée de flotte contre une force NPC (boss galactique, vagues d'invasion) : logique commune. */
export type Tx = Prisma.TransactionClient;
export type Ships = Record<number, number>;

export function readShips(raw: unknown): Ships {
  const result: Ships = {};
  for (const [id, amount] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const n = Math.floor(Number(amount));
    if (SHIPS[Number(id)] && Number.isFinite(n) && n > 0) result[Number(id)] = n;
  }
  return result;
}

export function positiveShips(raw: Record<string, number>): Ships {
  const result: Ships = {};
  for (const [id, count] of Object.entries(raw)) if (count > 0) result[Number(id)] = count;
  return result;
}

export interface NpcFight {
  result: 'attacker_win' | 'defender_win' | 'draw';
  rounds: number;
  survivors: Ships;
  attackerLosses: Ships;
  npcLosses: Ships;
  /** Flotte NPC restante après le combat. */
  remaining: Ships;
  /** Valeur (équivalent métal) des vaisseaux NPC détruits. */
  damage: number;
  healthAfter: number;
  killed: boolean;
}

/**
 * Combat d'un joueur contre une flotte NPC : technologies d'armes, de coque et de bouclier du joueur (109 à 111)
 * lues dans la transaction de l'appelant ; `max` sert à calculer la santé restante (0 à 1).
 */
export async function fightNpcFleet(
  tx: Tx,
  input: { userId: string; ships: Ships; current: Ships; max: Ships; npcTech: { weapon: number; shield: number; armor: number } },
): Promise<NpcFight> {
  const techRows = await tx.technology.findMany({
    where: { userId: input.userId, techId: { in: [109, 110, 111] } },
    select: { techId: true, level: true },
  });
  const level = (id: number) => techRows.find((row) => row.techId === id)?.level ?? 0;

  const combat = simulateCombat({
    attackerShips: input.ships,
    defenderShips: input.current,
    attackerTech: { weapon: level(109), armor: level(110), shield: level(111) },
    defenderTech: input.npcTech,
  });

  const remaining = positiveShips(combat.defenderRemaining as Record<string, number>);
  const npcLosses = positiveShips(combat.defenderLosses as Record<string, number>);
  return {
    result: combat.result,
    rounds: combat.rounds,
    survivors: combat.attackerRemaining,
    attackerLosses: positiveShips(combat.attackerLosses as Record<string, number>),
    npcLosses,
    remaining,
    damage: fleetValue(npcLosses),
    healthAfter: bossHealthRatio(remaining, input.max),
    killed: shipTotal(remaining) === 0,
  };
}

/** Planète d'origine d'une flotte (reçoit la part de butin) ; à défaut, première planète du joueur. */
export async function originPlanetId(
  tx: Tx,
  fleet: { userId: string; fromGalaxy: number; fromSystem: number; fromPosition: number; fromMoon: boolean },
): Promise<string | null> {
  const origin =
    (await tx.planet.findFirst({
      where: { userId: fleet.userId, galaxy: fleet.fromGalaxy, system: fleet.fromSystem, position: fleet.fromPosition, isMoon: fleet.fromMoon },
      select: { id: true },
    })) ?? (await tx.planet.findFirst({ where: { userId: fleet.userId, isMoon: false }, orderBy: { createdAt: 'asc' }, select: { id: true } }));
  return origin?.id ?? null;
}

export interface ArrivingFleet {
  id: string;
  userId: string;
  ships: unknown;
  cargo: unknown;
  fromGalaxy: number;
  fromSystem: number;
  fromPosition: number;
  fromMoon: boolean;
  toGalaxy: number;
  toSystem: number;
}

/**
 * Arrivée d'une flotte en attaque (mission 1) en position 16 : prise en charge unique de la flotte (« returning »),
 * combat par `fight`, puis survivants au retour (flotte terminée s'il n'en reste aucun, cargaison réduite à
 * proportion des pertes). `fight` renvoie null s'il n'y a plus d'adversaire : la flotte rentre intacte.
 * Renvoie false si la flotte a déjà été prise en charge (une seule résolution par flotte).
 */
export async function settleNpcArrival(
  database: DatabaseService,
  fleet: ArrivingFleet,
  fight: (tx: Tx, originId: string, sent: Ships) => Promise<{ survivors: Ships } | null>,
): Promise<boolean> {
  return database.$transaction(async (tx) => {
    const claimed = await tx.fleet.updateMany({ where: { id: fleet.id, status: 'traveling' }, data: { status: 'returning' } });
    if (claimed.count !== 1) return false;
    const originId = await originPlanetId(tx, fleet);
    const sent = readShips(fleet.ships);
    const outcome = originId ? await fight(tx, originId, sent) : null;
    // Plus d'adversaire (détruit ou retiré entre l'envoi et l'arrivée) : la flotte rentre intacte
    if (!outcome) return true;
    if (shipTotal(outcome.survivors) === 0) {
      await tx.fleet.update({ where: { id: fleet.id }, data: { status: 'completed', ships: {}, cargo: {}, returnTime: null } });
      return true;
    }
    // Cargaison réduite à proportion des vaisseaux perdus (elle ne peut pas dépasser ce que les survivants portent)
    const keep = shipTotal(outcome.survivors) / Math.max(1, shipTotal(sent));
    const cargo = (fleet.cargo ?? {}) as Record<string, unknown>;
    const scaled = Object.fromEntries(
      ['metal', 'crystal', 'deuterium'].map((resource) => [resource, Math.floor((Number(cargo[resource]) || 0) * keep)]),
    );
    await tx.fleet.update({ where: { id: fleet.id }, data: { ships: outcome.survivors as unknown as Prisma.InputJsonValue, cargo: scaled } });
    return true;
  });
}
