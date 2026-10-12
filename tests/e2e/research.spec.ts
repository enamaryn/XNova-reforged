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

test('page détail : lancer, finaliser et voir le niveau', async ({ page }) => {
  const credentials = buildCredentials('e2e_resdet');

  await registerUser(page, credentials);
  await seedResearchLab(credentials.username);

  // Technologie sans seuil d'énergie et dont le prérequis (laboratoire 1) est satisfait : Énergie (113)
  await page.goto('/research/113');
  await expect(page.getByRole('heading', { name: /Énergie/ })).toBeVisible();
  await expect(page.getByText('Niveau actuel')).toBeVisible();

  const launch = page.getByRole('button', { name: 'Lancer la recherche' });
  await expect(launch).toBeEnabled();
  await launch.click();

  // Démarrée : message de succès, bouton désactivé « Recherche en cours »
  await expect(page.getByText('Recherche lancée.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recherche en cours' })).toBeDisabled();

  // Finalisation : on avance l'échéance, le cron de recherche (toutes les 10 s) la termine
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username } });
  await prisma.researchQueue.updateMany({
    where: { userId: user.id, completed: false },
    data: { endTime: new Date(Date.now() - 1000) },
  });

  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Niveau actuel').locator('..')).toContainText('1', { timeout: 2000 });
  }).toPass({ timeout: 60_000, intervals: [3000] });

  const tech = await prisma.technology.findFirst({ where: { userId: user.id, techId: 113 } });
  expect(tech?.level).toBe(1);
});

test('page détail : une technologie sans énergie suffisante ne peut pas être lancée', async ({ page }) => {
  const credentials = buildCredentials('e2e_graviton');

  await registerUser(page, credentials);
  await seedResearchLab(credentials.username);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username } });
  await prisma.planet.updateMany({ where: { userId: user.id }, data: { researchLab: 12 } });

  // Graviton (199) : seuil d'énergie 300 000, la planète de départ ne produit pas autant
  await page.goto('/research/199');
  await expect(page.getByText(/Énergie produite/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lancer la recherche' })).toBeDisabled();
});

test('les coûts du prochain niveau sont visibles dans la liste, sans ouvrir les détails', async ({ page }) => {
  const credentials = buildCredentials('e2e_rcost');
  await registerUser(page, credentials);
  await seedResearchLab(credentials.username);

  await page.goto('/research');
  const cost = page.getByTestId('research-cost-106');
  await expect(cost).toBeVisible();
  await expect(cost).toContainText('Métal');
  await expect(cost).toContainText('Cristal');
  await expect(cost.locator('[data-short]')).toHaveCount(0);

  // Stock insuffisant : le poste manquant est signalé
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  await prisma.planet.update({ where: { id: user.planets[0].id }, data: { crystal: 0 } });
  await page.reload();
  await expect(page.getByTestId('research-cost-106').locator('[data-short="true"]').first()).toBeVisible();
});
