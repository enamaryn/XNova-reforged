import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('lune : sélectionnable, ses propres bâtiments, aucune mine', async ({ page }) => {
  const credentials = buildCredentials('e2e_moon');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const planet = user.planets[0];
  await prisma.planet.create({
    data: {
      userId: user.id,
      name: 'Lune',
      galaxy: planet.galaxy,
      system: planet.system,
      position: planet.position,
      isMoon: true,
      planetType: 'moon',
      metal: 5_000_000,
      crystal: 5_000_000,
      deuterium: 5_000_000,
      fieldsMax: 1,
      fieldsUsed: 0,
    },
  });

  // Planète : pas de base lunaire
  await page.goto('/buildings');
  await expect(page.getByRole('article', { name: 'Mine de Métal', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Base Lunaire', exact: true })).toHaveCount(0);

  // Bascule sur la lune depuis le sélecteur de planète
  await page.reload();
  await page.getByRole('button', { name: /Planète Mère|Planete Mere/i }).first().click();
  await page.getByRole('button', { name: /Lune/ }).click();

  await expect(page.getByRole('article', { name: 'Base Lunaire', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Mine de Métal', exact: true })).toHaveCount(0);
  await page.getByRole('article', { name: 'Base Lunaire', exact: true }).getByRole('button', { name: /Construire niveau/ }).click();
  await expect(page.getByText('File de construction')).toBeVisible();
});

test('rapport de combat : annonce la naissance d\'une lune', async ({ page }) => {
  const credentials = buildCredentials('e2e_moonrep');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const defender = await prisma.user.create({
    data: {
      username: `e2e_mdef_${Date.now()}`.slice(0, 20),
      email: `e2e_mdef_${Date.now()}@xnova.local`,
      password: 'seeded',
      points: 0,
      rank: 0,
    },
  });
  const planet = user.planets[0];
  const report = await prisma.combatReport.create({
    data: {
      attackerId: user.id,
      defenderId: defender.id,
      attackerShips: { 204: 3 },
      defenderShips: { 204: 2 },
      defenderDefs: {},
      attackerLosses: { 204: 1 },
      defenderLosses: { 204: 2 },
      result: 'attacker_win',
      rounds: 1,
      timeline: [],
      loot: { metal: 100, crystal: 50, deuterium: 0 },
      debris: { metal: 300000, crystal: 100000 },
      moonCreated: true,
      galaxy: planet.galaxy,
      system: planet.system,
      position: planet.position,
    },
  });
  await page.goto(`/reports/${report.id}`);
  await expect(page.getByTestId('report-moon-created')).toBeVisible();
});

test('page Lune : phalange (balayage) et porte de saut (transfert, recharge)', async ({ page, browser }) => {
  const credentials = buildCredentials('e2e_gate');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const baseSystem = 100 + Math.floor(Math.random() * 300);
  await prisma.planet.update({
    where: { id: user.planets[0].id },
    data: { galaxy: 6, system: baseSystem, position: 3 },
  });

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const otherCredentials = buildCredentials('e2e_watch');
  await registerUser(otherPage, otherCredentials);
  const other = await prisma.user.findUniqueOrThrow({
    where: { username: otherCredentials.username },
    include: { planets: true },
  });
  await prisma.planet.update({
    where: { id: other.planets[0].id },
    data: { galaxy: 6, system: baseSystem + 2, position: 9 },
  });

  const moon = await prisma.planet.create({
    data: {
      userId: user.id, name: 'Lune', galaxy: 6, system: baseSystem, position: 3, isMoon: true,
      planetType: 'moon', deuterium: 20000, fieldsMax: 10, phalanx: 2, moonBase: 1, jumpGate: 1,
    },
  });
  // Seconde lune du joueur, sur une colonie
  await prisma.planet.create({
    data: { userId: user.id, name: 'Colonie', galaxy: 6, system: baseSystem + 4, position: 5, fieldsMax: 163 },
  });
  const moon2 = await prisma.planet.create({
    data: {
      userId: user.id, name: 'Lune', galaxy: 6, system: baseSystem + 4, position: 5, isMoon: true,
      planetType: 'moon', fieldsMax: 10, moonBase: 1, jumpGate: 1,
    },
  });
  await prisma.ship.create({ data: { planetId: moon.id, shipId: 202, amount: 5 } });
  // Un mouvement visible autour de la planète voisine
  await prisma.fleet.create({
    data: {
      userId: other.id, fromGalaxy: 6, fromSystem: baseSystem + 2, fromPosition: 9,
      toGalaxy: 6, toSystem: baseSystem + 50, toPosition: 2, mission: 3, ships: { '202': 4 }, cargo: {},
      startTime: new Date(), arrivalTime: new Date(Date.now() + 900_000),
      returnTime: new Date(Date.now() + 1_800_000), status: 'traveling',
    },
  });

  await page.goto('/moon');
  await expect(page.getByTestId('moon-select-hint')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /Planète Mère|Planete Mere/i }).first().click();
  await page.getByRole('button', { name: /Lune/ }).first().click();

  await expect(page.getByTestId('phalanx-range')).toContainText('3 systèmes');
  await page.getByTestId('phalanx-system').fill(String(baseSystem + 2));
  await page.getByTestId('phalanx-position').fill('9');
  await page.getByTestId('phalanx-scan').click();
  await expect(page.getByTestId('phalanx-movement')).toHaveCount(1);
  await expect(page.getByTestId('phalanx-movement')).toContainText('4 vaisseau');

  await page.getByTestId('gate-destination').selectOption(moon2.id);
  await page.getByTestId('gate-ship-202').fill('3');
  await page.getByTestId('gate-jump').click();
  await expect(page.getByTestId('gate-done')).toBeVisible();
  await expect(page.getByTestId('gate-jump')).toBeDisabled();
  await expect(page.getByTestId('gate-state')).toContainText('recharge');
  const moved = await prisma.ship.findFirstOrThrow({ where: { planetId: moon2.id, shipId: 202 } });
  expect(moved.amount).toBe(3);
  await otherContext.close();
});
