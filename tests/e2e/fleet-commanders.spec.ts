import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('recruter un commandant, dépenser un point de compétence puis le renvoyer', async ({ page }) => {
  const credentials = buildCredentials('e2e_cmdr');
  await registerUser(page, credentials);

  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username }, include: { planets: true } });
  // sous la capacité de stockage de départ, pour que rien ne soit rogné
  await prisma.planet.update({ where: { id: user.planets[0].id }, data: { deuterium: 1_000_000 } });

  await page.goto('/commanders');
  await expect(page.getByTestId('commanders-empty')).toBeVisible();

  await page.getByTestId('commander-name').fill('Aldric');
  await page.getByTestId('commander-recruit-button').click();
  const card = page.getByTestId('commander-Aldric');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('skill-Aldric-attack')).toBeDisabled();

  // un point gagné (par exemple au combat) rend le bouton actif
  await prisma.fleetCommander.updateMany({ where: { userId: user.id }, data: { skillPoints: 1 } });
  await page.reload();
  await page.getByTestId('skill-Aldric-attack').click();
  await expect(card).toContainText('1/10');
  await expect(card).toContainText('+1 %');
  await expect(page.getByTestId('skill-Aldric-attack')).toBeDisabled();

  await card.getByRole('button', { name: /Renvoyer/ }).click();
  await expect(page.getByTestId('commanders-empty')).toBeVisible();
  expect(await prisma.fleetCommander.count({ where: { userId: user.id } })).toBe(0);
});
