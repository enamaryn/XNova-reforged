import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

async function seedResearchLab(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { planets: true },
  });

  if (!user || user.planets.length === 0) {
    throw new Error('Utilisateur E2E introuvable');
  }

  const planet = user.planets[0];

  // Ajouter un laboratoire de recherche niveau 1 pour permettre la recherche
  await prisma.planet.update({
    where: { id: planet.id },
    data: {
      researchLab: 1,
      metal: 100000,
      crystal: 100000,
      deuterium: 100000,
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('lancer une recherche', async ({ page }) => {
  const credentials = buildCredentials('e2e_research');

  await registerUser(page, credentials);

  await seedResearchLab(credentials.username);

  await page.goto('/research');
  await expect(page.locator('h1')).toContainText(/Technologies/);

  // Chercher un bouton de recherche disponible
  const researchButtons = page.getByRole('button', { name: /Lancer la recherche/ });
  const total = await researchButtons.count();
  let clicked = false;

  for (let index = 0; index < total; index += 1) {
    const button = researchButtons.nth(index);
    if (await button.isEnabled()) {
      await button.click();
      clicked = true;
      break;
    }
  }

  expect(clicked).toBe(true);

  // Vérifier qu'une recherche est en cours
  await expect(page.getByText(/Recherche en cours/)).toBeVisible();
});
