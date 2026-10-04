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

  // Le scénario nominal exige un bouton activé : plus de contournement si absent
  await expect(buildButton).toBeVisible();
  await buildButton.click();

  // La file d'attente doit afficher au moins 1 construction (et non « 0 en cours »)
  await expect(page.getByText(/[1-9]\d* en cours/).first()).toBeVisible();
});
