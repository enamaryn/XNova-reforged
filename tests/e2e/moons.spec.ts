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
