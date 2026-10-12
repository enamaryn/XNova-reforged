import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('embaucher un officier depuis la page Officiers', async ({ page }) => {
  const credentials = buildCredentials('e2e_officers');
  await registerUser(page, credentials);

  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username }, include: { planets: true } });
  // sous la capacité de stockage de départ, pour que rien ne soit rogné
  await prisma.planet.update({ where: { id: user.planets[0].id }, data: { deuterium: 1_000_000 } });

  await page.goto('/officers');
  await expect(page.getByTestId('officer-geologist')).toBeVisible();
  await expect(page.getByTestId('officer-geologist')).toHaveAttribute('data-hired', 'false');

  await page.getByTestId('hire-geologist').click();
  await expect(page.getByTestId('officer-geologist')).toHaveAttribute('data-hired', 'true');
  await expect(page.getByTestId('hire-geologist')).toHaveCount(0);
  expect(await prisma.officer.count({ where: { userId: user.id, type: 'geologist' } })).toBe(1);

  // deutérium insuffisant pour un second : l'erreur est affichée, rien n'est embauché
  await prisma.planet.update({ where: { id: user.planets[0].id }, data: { deuterium: 10 } });
  await page.getByTestId('hire-admiral').click();
  await expect(page.getByTestId('officers-error')).toBeVisible();
  await expect(page.getByTestId('officer-admiral')).toHaveAttribute('data-hired', 'false');
});
