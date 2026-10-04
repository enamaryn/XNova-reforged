import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CombatResult, MissionType } from '@xnova/game-config';
import { computeCargoCapacity, distributeLoot, simulateCombat } from '@xnova/game-engine';
import { CombatService } from '../src/combat/combat.service';

jest.mock('@xnova/game-engine', () => ({
  ...jest.requireActual('@xnova/game-engine'),
  simulateCombat: jest.fn(),
  computeCargoCapacity: jest.fn(),
  distributeLoot: jest.fn(),
}));

type MockDb = {
  planet: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  ship: {
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  technology: {
    findMany: jest.Mock;
  };
  combatReport: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  fleet: {
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

const createService = () => {
  const database: MockDb = {
    planet: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ship: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    technology: {
      findMany: jest.fn(),
    },
    combatReport: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    fleet: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const gameEvents = {
    emitToUser: jest.fn(),
  };

  return {
    service: new CombatService(database as any, gameEvents as any),
    database,
    gameEvents,
  };
};

const simulateCombatMock = simulateCombat as jest.MockedFunction<typeof simulateCombat>;
const computeCargoCapacityMock = computeCargoCapacity as jest.MockedFunction<
  typeof computeCargoCapacity
>;
const distributeLootMock = distributeLoot as jest.MockedFunction<typeof distributeLoot>;

const buildTx = (stock: { metal: number; crystal: number; deuterium: number }) => ({
  $queryRaw: jest.fn().mockResolvedValue([]),
  fleet: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    update: jest.fn().mockResolvedValue({}),
  },
  planet: {
    findUniqueOrThrow: jest.fn().mockResolvedValue(stock),
    update: jest.fn().mockResolvedValue({}),
  },
  combatReport: {
    create: jest.fn().mockResolvedValue({ id: 'report-1', result: 'attacker_win' }),
  },
  ship: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

const baseFleet = {
  id: 'fleet-1',
  userId: 'user-1',
  mission: MissionType.ATTACK,
  ships: { 202: 3 },
  cargo: {},
  startTime: new Date('2025-01-01T00:00:00.000Z'),
  arrivalTime: new Date('2025-01-01T01:00:00.000Z'),
  returnTime: null,
  status: 'traveling',
  fromGalaxy: 1,
  fromSystem: 1,
  fromPosition: 1,
  toGalaxy: 2,
  toSystem: 3,
  toPosition: 4,
};

describe('CombatService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ignore les missions non offensives', async () => {
    const { service, database } = createService();
    const result = await service.resolveAttackMission({
      ...baseFleet,
      mission: MissionType.TRANSPORT,
    });

    expect(result).toBeNull();
    expect(database.planet.findFirst).not.toHaveBeenCalled();
  });

  it('fait revenir la flotte si la cible est absente', async () => {
    const { service, database } = createService();
    database.planet.findFirst.mockResolvedValue(null);
    database.fleet.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveAttackMission(baseFleet);

    expect(result).toBeNull();
    expect(database.fleet.updateMany).toHaveBeenCalledWith({
      where: { id: 'fleet-1', status: 'traveling' },
      data: { status: 'returning' },
    });
  });

  it('cree un rapport et met a jour les ressources quand l attaquant gagne', async () => {
    const { service, database, gameEvents } = createService();
    const target = {
      id: 'planet-2',
      userId: 'user-2',
      metal: 1000,
      crystal: 800,
      deuterium: 200,
    };

    const combatSummary = {
      rounds: 1,
      result: CombatResult.ATTACKER_WIN,
      attackerRemaining: { 202: 2 },
      defenderRemaining: { 401: 0 },
      attackerLosses: { 202: 1 },
      defenderLosses: { 401: 2 },
      timeline: [],
      debris: { metal: 0, crystal: 0 },
    };

    database.planet.findFirst.mockResolvedValue(target);
    database.ship.findMany.mockResolvedValue([{ shipId: 401, amount: 2 }]);
    database.technology.findMany
      .mockResolvedValueOnce([{ techId: 109, level: 1 }])
      .mockResolvedValueOnce([{ techId: 109, level: 0 }]);
    simulateCombatMock.mockReturnValue(combatSummary as any);
    computeCargoCapacityMock.mockReturnValue(500);
    distributeLootMock.mockReturnValue({ metal: 100, crystal: 50, deuterium: 0 });

    const tx = buildTx({ metal: 1000, crystal: 800, deuterium: 200 });
    database.$transaction.mockImplementation((cb: any) => cb(tx));

    const report = await service.resolveAttackMission(baseFleet);

    expect(report).toEqual({ id: 'report-1', result: 'attacker_win' });
    expect(tx.fleet.updateMany).toHaveBeenCalledWith({
      where: { id: 'fleet-1', status: 'traveling' },
      data: { status: 'returning' },
    });
    expect(tx.combatReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attackerId: 'user-1',
        defenderId: 'user-2',
        loot: { metal: 100, crystal: 50, deuterium: 0 },
        galaxy: 2,
        system: 3,
        position: 4,
      }),
    });
    expect(tx.planet.update).toHaveBeenCalledWith({
      where: { id: 'planet-2' },
      data: {
        metal: { decrement: 100 },
        crystal: { decrement: 50 },
        deuterium: { decrement: 0 },
      },
    });
    expect(tx.fleet.update).toHaveBeenCalledWith({
      where: { id: 'fleet-1' },
      data: {
        status: 'returning',
        ships: { 202: 2 },
        cargo: { metal: 100, crystal: 50, deuterium: 0 },
      },
    });
    expect(tx.ship.updateMany).toHaveBeenCalledWith({
      where: { planetId: 'planet-2', shipId: 401, amount: { gte: 2 } },
      data: { amount: { decrement: 2 } },
    });
    expect(gameEvents.emitToUser).toHaveBeenCalledWith('user-1', 'combat:report', {
      reportId: 'report-1',
      result: CombatResult.ATTACKER_WIN,
      opponentId: 'user-2',
    });
    expect(gameEvents.emitToUser).toHaveBeenCalledWith('user-2', 'combat:report', {
      reportId: 'report-1',
      result: CombatResult.ATTACKER_WIN,
      opponentId: 'user-1',
    });
  });

  it('verifie les droits d acces au rapport', async () => {
    const { service, database } = createService();
    database.combatReport.findUnique.mockResolvedValue({
      id: 'report-1',
      attackerId: 'user-1',
      defenderId: 'user-2',
    });

    await expect(service.getReportById('report-1', 'other-user')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getReportById('report-1', 'user-2')).resolves.toEqual({
      id: 'report-1',
      attackerId: 'user-1',
      defenderId: 'user-2',
    });
  });

  it('refuse un rapport inexistant', async () => {
    const { service, database } = createService();
    database.combatReport.findUnique.mockResolvedValue(null);

    await expect(service.getReportById('missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
