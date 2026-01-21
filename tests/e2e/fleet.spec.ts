import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

async function seedFleet(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { planets: true },
  });

  if (!user || user.planets.length === 0) {
    throw new Error('Utilisateur E2E introuvable');
  }

  const planet = user.planets[0];

  await prisma.planet.update({
    where: { id: planet.id },
    data: {
      metal: 100000,
      crystal: 100000,
      deuterium: 100000,
    },
  });

  await prisma.ship.upsert({
    where: {
      planetId_shipId: {
        planetId: planet.id,
        shipId: 202,
      },
    },
    update: { amount: 5 },
    create: {
      planetId: planet.id,
      shipId: 202,
      amount: 5,
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('envoi flotte', async ({ page }) => {
  const credentials = buildCredentials('e2e_fleet');

  await registerUser(page, credentials);

  await seedFleet(credentials.username);

  await page.goto('/fleet');
  await expect(page.locator('h1')).toContainText(/Flotte/);

  const shipRow = page.getByText('Petit Transporteur');
  await expect(shipRow).toBeVisible();

  const shipInput = shipRow.locator('..').locator('..').getByRole('spinbutton');
  await shipInput.fill('1');

  await page.getByRole('button', { name: 'Envoyer la flotte' }).click();
  await expect(page.getByText(/Mission \d+/)).toBeVisible();
});
