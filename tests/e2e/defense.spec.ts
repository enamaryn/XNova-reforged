import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('défense : construire un lanceur de missiles puis le voir en stock', async ({ page }) => {
  const credentials = buildCredentials('e2e_defense');
  await registerUser(page, credentials);

  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const planet = user.planets[0];
  await prisma.planet.update({
    where: { id: planet.id },
    data: { shipyard: 1, metal: 100000, crystal: 100000, deuterium: 100000 },
  });

  await page.goto('/defense');
  await expect(page.getByRole('heading', { name: 'Défense' })).toBeVisible();
  const launcher = page.getByTestId('defense-401');
  await expect(launcher).toContainText('Lanceur de Missiles');

  // Les défenses sans prérequis restent bloquées et expliquées
  await expect(page.getByTestId('defense-402').getByRole('button', { name: 'Construire' })).toBeDisabled();

  await launcher.getByLabel('Quantité Lanceur de Missiles').fill('3');
  await launcher.getByRole('button', { name: 'Construire' }).click();
  await expect(launcher.getByText(/En file \(3\)/)).toBeVisible();

  // Finalisation : on avance l'échéance, le cron du chantier (toutes les 10 s) la termine
  await prisma.shipQueue.updateMany({
    where: { planetId: planet.id, completed: false },
    data: { endTime: new Date(Date.now() - 1000) },
  });

  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId('defense-amount-401')).toHaveText('3', { timeout: 2000 });
  }).toPass({ timeout: 60_000, intervals: [3000] });

  const stored = await prisma.defense.findFirst({ where: { planetId: planet.id, defenseId: 401 } });
  expect(stored?.amount).toBe(3);
});
