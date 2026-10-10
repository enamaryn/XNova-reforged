import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('navigation galaxie : la vue s\'ouvre sur la planète du joueur', async ({ page }) => {
  const credentials = buildCredentials('e2e_galaxy');

  await registerUser(page, credentials);

  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const planet = user.planets[0];

  await page.goto('/galaxy');
  await expect(page.locator('h1')).toContainText(/Galaxie/);

  // Les sélecteurs de galaxie et de système démarrent sur la position de la planète (pas sur 1:1)
  const galaxyInput = page.locator('input[type="number"]').first();
  const systemInput = page.locator('input[type="number"]').nth(1);
  await expect(galaxyInput).toHaveValue(String(planet.galaxy));
  await expect(systemInput).toHaveValue(String(planet.system));

  // La planète du joueur est visible et signalée
  const coordinates = `${planet.galaxy}:${planet.system}:${planet.position}`;
  const own = page.locator('[data-own="true"]');
  await expect(own).toHaveCount(1);
  await expect(own).toContainText(coordinates);
  await expect(own).toContainText('Vous');

  // La navigation manuelle reste possible
  await systemInput.fill(String(planet.system === 1 ? 2 : 1));
  await expect(page.locator('[data-own="true"]')).toHaveCount(0);

  // La colonisation est une mission : une position libre propose un lien vers le formulaire de flotte
  const colonizeLink = page.getByRole('link', { name: /Coloniser/ });
  expect(await colonizeLink.count()).toBeGreaterThan(0);
  await expect(colonizeLink.first()).toHaveAttribute('href', /\/fleet\?mission=colonize&galaxy=/);
});
