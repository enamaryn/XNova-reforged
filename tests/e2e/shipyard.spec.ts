import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

async function seedShipyard(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { planets: true },
  });

  if (!user || user.planets.length === 0) {
    throw new Error('Utilisateur E2E introuvable');
  }

  const planet = user.planets[0];

  // Ajouter un hangar niveau 2 pour permettre la construction de vaisseaux
  await prisma.planet.update({
    where: { id: planet.id },
    data: {
      shipyard: 2,
      metal: 100000,
      crystal: 100000,
      deuterium: 100000,
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('construction vaisseau', async ({ page }) => {
  const credentials = buildCredentials('e2e_shipyard');

  await registerUser(page, credentials);

  await seedShipyard(credentials.username);

  await page.goto('/shipyard');
  await expect(page.locator('h1')).toContainText(/Chantier spatial/);

  // Chercher un bouton Construire activé (Satellite Solaire devrait être dispo avec hangar lvl 2)
  const buildButton = page.locator('button:not([disabled])').filter({ hasText: 'Construire' }).first();

  // Si le bouton est visible et activé, cliquer
  const isVisible = await buildButton.isVisible().catch(() => false);

  if (isVisible) {
    await buildButton.click();
  }

  // Vérifier que la file d'attente affiche au moins 1 construction
  await expect(page.getByText(/\d+ en cours/)).toBeVisible();
});
