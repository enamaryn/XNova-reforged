import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GAME_CONSTANTS } from '@xnova/game-config';
import { updateResources } from '@xnova/game-engine';
import { ResourcesService } from '../src/resources/resources.service';

jest.mock('@xnova/game-engine', () => ({
  updateResources: jest.fn(),
}));

type MockDb = {
  planet: {
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
  };
  ship: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const createService = () => {
  const database: MockDb = {
    planet: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    ship: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const serverConfig = {
    getConfig: jest.fn(),
    getResourceConfig: jest.fn(),
  };

  return {
    service: new ResourcesService(database as any, serverConfig as any),
    database,
    serverConfig,
  };
};

const updateResourcesMock = updateResources as jest.MockedFunction<typeof updateResources>;

describe('ResourcesService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('met a jour les ressources et retourne le recapitulatif', async () => {
    const { service, database, serverConfig } = createService();
    const now = new Date('2025-01-01T00:00:00.000Z');
    const planet = {
      id: 'planet-1',
      userId: 'user-1',
      metal: 10,
      crystal: 20,
      deuterium: 30,
      metalProduction: 0,
      crystalProduction: 0,
      deuteriumProduction: 0,
      energyUsed: 0,
      energyAvailable: 0,
      lastUpdate: new Date('2024-12-31T23:00:00.000Z'),
      metalMine: 1,
      crystalMine: 1,
      deuteriumMine: 1,
      solarPlant: 1,
      fusionPlant: 0,
      metalStorage: 1,
      crystalStorage: 1,
      deuteriumStorage: 1,
    };

    const calculation = {
      resources: {
        metal: 120,
        crystal: 220,
        deuterium: 15,
      },
      productionPerHour: {
        metal: 300,
        crystal: 200,
        deuterium: 50,
      },
      energy: {
        used: 10,
        available: 20,
        productionLevel: 0.75,
      },
      storage: {
        metal: 1000,
        crystal: 800,
        deuterium: 600,
      },
      lastUpdate: now,
    };

    serverConfig.getResourceConfig.mockResolvedValue({
      baseIncome: { metal: 20, crystal: 10, deuterium: 0 },
      resourceMultiplier: 1,
      gameSpeed: 1,
      storageBase: 1_000_000,
      storageFactor: 1.5,
      storageOverflow: 1.1,
    });
    database.planet.findUnique.mockResolvedValue(planet);
    updateResourcesMock.mockReturnValue(calculation as any);
    database.planet.update.mockResolvedValue({
      ...planet,
      ...calculation.resources,
      metalProduction: calculation.productionPerHour.metal,
      crystalProduction: calculation.productionPerHour.crystal,
      deuteriumProduction: calculation.productionPerHour.deuterium,
      energyUsed: calculation.energy.used,
      energyAvailable: calculation.energy.available,
      lastUpdate: calculation.lastUpdate,
    });

    const result = await service.getPlanetResources('planet-1', 'user-1');

    expect(updateResourcesMock).toHaveBeenCalledTimes(1);
    expect(database.planet.update).toHaveBeenCalledWith({
      where: { id: 'planet-1' },
      data: {
        metal: 120,
        crystal: 220,
        deuterium: 15,
        metalProduction: 300,
        crystalProduction: 200,
        deuteriumProduction: 50,
        energyUsed: 10,
        energyAvailable: 20,
        lastUpdate: now,
      },
    });
    expect(result).toEqual({
      planetId: 'planet-1',
      resources: {
        metal: 120,
        crystal: 220,
        deuterium: 15,
      },
      production: {
        metal: 300,
        crystal: 200,
        deuterium: 50,
      },
      energy: {
        used: 10,
        available: 20,
        productionLevel: 0.75,
      },
      storage: calculation.storage,
      lastUpdate: now,
    });
  });

  it('refuse le renommage si la planete est absente', async () => {
    const { service, database } = createService();
    database.planet.findUnique.mockResolvedValue(null);

    await expect(service.renamePlanet('planet-1', 'user-1', 'Alpha')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuse le renommage si l utilisateur ne possede pas la planete', async () => {
    const { service, database } = createService();
    database.planet.findUnique.mockResolvedValue({ id: 'planet-1', userId: 'other-user' });

    await expect(service.renamePlanet('planet-1', 'user-1', 'Alpha')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('renomme la planete quand les conditions sont valides', async () => {
    const { service, database } = createService();
    database.planet.findUnique.mockResolvedValue({ id: 'planet-1', userId: 'user-1' });
    database.planet.update.mockResolvedValue({
      id: 'planet-1',
      name: 'Alpha',
      galaxy: 1,
      system: 2,
      position: 3,
    });

    const result = await service.renamePlanet('planet-1', 'user-1', 'Alpha');

    expect(database.planet.update).toHaveBeenCalledWith({
      where: { id: 'planet-1' },
      data: { name: 'Alpha' },
      select: {
        id: true,
        name: true,
        galaxy: true,
        system: true,
        position: true,
      },
    });
    expect(result).toEqual({
      id: 'planet-1',
      name: 'Alpha',
      galaxy: 1,
      system: 2,
      position: 3,
    });
  });

  it('refuse la colonisation si les coordonnees sont hors limites', async () => {
    const { service } = createService();

    await expect(
      service.colonizePlanet({
        userId: 'user-1',
        originPlanetId: 'origin',
        galaxy: 0,
        system: 1,
        position: 1,
        name: 'Colonie',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse la colonisation si le joueur a trop de planetes', async () => {
    const { service, database } = createService();
    database.planet.count.mockResolvedValue(GAME_CONSTANTS.MAX_PLAYER_PLANETS);

    await expect(
      service.colonizePlanet({
        userId: 'user-1',
        originPlanetId: 'origin',
        galaxy: 1,
        system: 1,
        position: 1,
        name: 'Colonie',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cree une colonie quand les conditions sont valides', async () => {
    const { service, database, serverConfig } = createService();
    const origin = { id: 'origin', userId: 'user-1' };

    database.planet.count.mockResolvedValue(0);
    database.planet.findUnique
      .mockResolvedValueOnce(origin)
      .mockResolvedValueOnce(null);
    database.ship.findUnique.mockResolvedValue({ amount: 1 });
    serverConfig.getConfig.mockResolvedValue({ planetSize: 150 });
    database.planet.create.mockReturnValue({ id: 'new-planet', name: 'Colonie' });
    database.ship.update.mockReturnValue({});
    database.$transaction.mockResolvedValue([
      { id: 'new-planet', name: 'Colonie' },
    ]);

    const result = await service.colonizePlanet({
      userId: 'user-1',
      originPlanetId: 'origin',
      galaxy: 2,
      system: 3,
      position: 4,
      name: '   ',
    });

    expect(database.planet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Colonie',
          galaxy: 2,
          system: 3,
          position: 4,
          fieldsMax: 150,
        }),
      }),
    );
    expect(database.ship.update).toHaveBeenCalledWith({
      where: { planetId_shipId: { planetId: 'origin', shipId: 208 } },
      data: { amount: { decrement: 1 } },
    });
    expect(result).toEqual({
      success: true,
      planetId: 'new-planet',
      galaxy: 2,
      system: 3,
      position: 4,
      name: 'Colonie',
    });
  });
});
