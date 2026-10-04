import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { FleetCronService } from '../../src/fleet/fleet-cron.service';
import { createIntegrationApp } from './helpers';

/**
 * GAME-03 — combat complet avec le VRAI moteur via le cron de flotte : retour, pertes, cargaison
 * embarquée conservée selon la capacité des survivants, butin borné, rapport créé.
 */
describe('API integration - Cargo et combat (GAME-03)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fleetCron: any;

  const suffix = Math.random().toString(36).slice(2, 8);
  let attackerId: string;
  let defenderId: string;
  let origin: { id: string; galaxy: number; system: number; position: number };
  let target: { id: string; galaxy: number; system: number; position: number };

  const past = (s: number) => new Date(Date.now() - s * 1000);

  const attack = (ships: Record<string, number>, cargo: Record<string, number>) =>
    database.fleet.create({
      data: {
        userId: attackerId,
        fromGalaxy: origin.galaxy,
        fromSystem: origin.system,
        fromPosition: origin.position,
        toGalaxy: target.galaxy,
        toSystem: target.system,
        toPosition: target.position,
        mission: 1,
        ships,
        cargo,
        startTime: past(120),
        arrivalTime: past(60),
        returnTime: past(10),
        status: 'traveling',
      } as any,
    });

  beforeAll(async () => {
    const integration = await createIntegrationApp();
    app = integration.app;
    database = integration.database;
    fleetCron = app.get(FleetCronService);

    const mk = (tag: string) =>
      database.user.create({
        data: { username: `g3${tag}_${suffix}`, email: `g3${tag}_${suffix}@example.test`, password: 'x' },
      });
    attackerId = (await mk('a')).id;
    defenderId = (await mk('d')).id;
    origin = await database.planet.create({
      data: { userId: attackerId, name: 'Origine', galaxy: 9, system: 480, position: 3 },
    });
    target = await database.planet.create({
      data: { userId: defenderId, name: 'Cible', galaxy: 9, system: 481, position: 4 },
    });
  });

  beforeEach(async () => {
    await database.fleet.deleteMany({ where: { userId: attackerId } });
    await database.combatReport.deleteMany({ where: { attackerId } });
    await database.ship.deleteMany({ where: { planetId: { in: [origin.id, target.id] } } });
    await database.planet.update({
      where: { id: origin.id },
      data: { metal: 0, crystal: 0, deuterium: 0 },
    });
    await database.planet.update({
      where: { id: target.id },
      data: { metal: 100000, crystal: 100000, deuterium: 100000 },
    });
  });

  afterAll(async () => {
    await database.user.deleteMany({ where: { id: { in: [attackerId, defenderId] } } });
    if (app) await app.close();
  });

  const totalCargo = (c: any) => Number(c.metal) + Number(c.crystal) + Number(c.deuterium);

  it('victoire : cargaison embarquée conservée, butin borné par la place libre, rapport créé, retour crédité', async () => {
    // 20 petits transporteurs (6000 chacun) = 120 000 de capacité ; 118 000 déjà embarqués
    const fleet = await attack({ '202': 20 }, { metal: 118000, crystal: 0, deuterium: 0 });

    await fleetCron.processArrivals();

    const after = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    const cargo = after.cargo as any;
    expect(after.status).toBe('returning');
    expect(cargo.metal).toBeGreaterThanOrEqual(118000); // la cargaison embarquée n'est plus écrasée
    expect(totalCargo(cargo)).toBeLessThanOrEqual(120000); // jamais au-delà de la capacité
    expect(totalCargo(cargo)).toBeGreaterThan(118000); // le butin remplit (une partie de) la place libre

    const reports = await database.combatReport.findMany({ where: { attackerId } });
    expect(reports).toHaveLength(1);
    const loot = reports[0].loot as any;
    expect(totalCargo(loot)).toBe(totalCargo(cargo) - 118000);

    const targetAfter = await database.planet.findUniqueOrThrow({ where: { id: target.id } });
    expect(300000 - (targetAfter.metal + targetAfter.crystal + targetAfter.deuterium)).toBe(
      totalCargo(loot),
    );

    // Retour : vaisseaux et cargaison (embarquée + butin) crédités une seule fois à l'origine
    await fleetCron.processReturns();
    const originAfter = await database.planet.findUniqueOrThrow({ where: { id: origin.id } });
    const ships = await database.ship.findUniqueOrThrow({
      where: { planetId_shipId: { planetId: origin.id, shipId: 202 } },
    });
    expect(ships.amount).toBe(20);
    expect(originAfter.metal + originAfter.crystal + originAfter.deuterium).toBe(totalCargo(cargo));
  });

  it('victoire sans butin possible : la cargaison embarquée est conservée', async () => {
    await database.planet.update({
      where: { id: target.id },
      data: { metal: 0, crystal: 0, deuterium: 0 },
    });
    const fleet = await attack({ '202': 5 }, { metal: 1000, crystal: 500, deuterium: 0 });

    await fleetCron.processArrivals();

    const after = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    expect(after.status).toBe('returning');
    expect(after.cargo).toEqual({ metal: 1000, crystal: 500, deuterium: 0 });
  });

  it('défaite totale : flotte terminée, cargaison perdue, rapport créé, rien ne revient', async () => {
    await database.ship.create({ data: { planetId: target.id, shipId: 207, amount: 300 } });
    const fleet = await attack({ '202': 1 }, { metal: 5000, crystal: 0, deuterium: 0 });

    await fleetCron.processArrivals();
    await fleetCron.processReturns();

    const after = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    expect(after.status).toBe('completed');
    expect(after.cargo).toEqual({});
    expect(await database.combatReport.count({ where: { attackerId } })).toBe(1);

    const originAfter = await database.planet.findUniqueOrThrow({ where: { id: origin.id } });
    expect(originAfter.metal).toBe(0);
    expect(await database.ship.count({ where: { planetId: origin.id } })).toBe(0);
    // Aucun butin : la cible garde ses ressources
    const targetAfter = await database.planet.findUniqueOrThrow({ where: { id: target.id } });
    expect(targetAfter.metal).toBe(100000);
  });

  it('pertes partielles : le défenseur perd des vaisseaux, la cargaison suit la capacité restante', async () => {
    await database.ship.create({ data: { planetId: target.id, shipId: 204, amount: 20 } }); // chasseurs légers
    const fleet = await attack(
      { '207': 30, '202': 10 },
      { metal: 60000, crystal: 0, deuterium: 0 },
    );

    await fleetCron.processArrivals();

    const after = await database.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    const report = await database.combatReport.findFirstOrThrow({ where: { attackerId } });
    const defenderShip = await database.ship.findUnique({
      where: { planetId_shipId: { planetId: target.id, shipId: 204 } },
    });
    expect(report.result).toBe('attacker_win');
    expect(defenderShip?.amount ?? 0).toBe(0);
    expect(after.status).toBe('returning');

    // Capacité réelle des survivants (aucune technologie) ; la cargaison ne peut pas la dépasser
    const survivors = after.ships as Record<string, number>;
    const capacity = Object.entries(survivors).reduce(
      (sum, [id, n]) => sum + ({ 202: 6000, 207: 1500 } as Record<string, number>)[id] * Number(n),
      0,
    );
    expect(totalCargo(after.cargo)).toBeLessThanOrEqual(capacity);
  });
});
