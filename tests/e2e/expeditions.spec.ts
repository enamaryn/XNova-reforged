import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('expédition : envoi en position 16 depuis la page Flotte, puis rapport', async ({ page }) => {
  const credentials = buildCredentials('e2e_expe');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const planet = user.planets[0];
  await prisma.planet.update({
    where: { id: planet.id },
    data: { metal: 100000, crystal: 100000, deuterium: 100000 },
  });
  await prisma.ship.create({ data: { planetId: planet.id, shipId: 202, amount: 5 } });
  await prisma.technology.create({ data: { userId: user.id, techId: 124, level: 1 } });

  // Le lien de la Galaxie préremplit l'expédition vers la position 16
  await page.goto(`/galaxy`);
  await expect(page.getByTestId('expedition-link')).toBeVisible();
  await page.getByTestId('expedition-link').click();
  await expect(page.getByTestId('expedition-help')).toBeVisible();

  const shipRow = page.getByText('Petit Transporteur');
  await expect(shipRow).toBeVisible();
  await shipRow.locator('..').locator('..').getByRole('spinbutton').fill('2');
  await page.getByRole('button', { name: 'Envoyer la flotte' }).click();
  await expect(page.getByText(/Mission 15/)).toBeVisible();

  const fleet = await prisma.fleet.findFirstOrThrow({ where: { userId: user.id, mission: 15 } });
  expect(fleet.toPosition).toBe(16);
  expect(fleet.ships).toEqual({ '202': 2 });

  // Arrivée : la tâche planifiée (10 s) résout l'expédition et écrit un rapport, quelle que soit l'issue
  await prisma.fleet.update({
    where: { id: fleet.id },
    data: { startTime: new Date(Date.now() - 360_000), arrivalTime: new Date(Date.now() - 60_000) },
  });
  await expect(async () => {
    await page.goto('/reports');
    await expect(page.getByTestId('expedition-report')).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 60_000, intervals: [3000] });
  await expect(page.getByTestId('expedition-report')).toContainText(`[${fleet.toGalaxy}:${fleet.toSystem}:16]`);
});
