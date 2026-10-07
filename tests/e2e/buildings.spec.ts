import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';
import { prisma } from '@xnova/database';

test.afterAll(() => prisma.$disconnect());

test('effets du prochain niveau dans la liste et les détails', async ({ page }) => {
  const credentials = buildCredentials('e2e_gain');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username }, include: { planets: true } });
  await prisma.planet.update({ where: { id: user.planets[0].id }, data: { crystalMine: 4, solarPlant: 10 } });
  await page.goto('/buildings');
  const card = page.getByRole('article', { name: 'Mine de Cristal', exact: true });
  await expect(card.getByRole('heading', { name: 'Au niveau 5' })).toBeVisible();
  await expect(card.getByText('+43,9/h', { exact: true })).toBeVisible();
  await expect(card.getByText('-22', { exact: true })).toBeVisible();
  await card.getByRole('link', { name: 'Détails' }).click();
  await expect(page.getByRole('heading', { name: 'Mine de Cristal', exact: true })).toBeVisible();
  const effects = page.getByRole('region', { name: 'Effets du niveau 5' });
  await expect(effects.getByRole('columnheader', { name: 'Variation' })).toBeVisible();
  await expect(effects.getByRole('row', { name: /Cristal à pleine puissance/ })).toContainText('+43,9/h');
  await expect(effects.getByRole('row', { name: /Solde d’énergie/ })).toContainText('-22');
});

test('construction batiment', async ({ page }) => {
  const credentials = buildCredentials('e2e_build');

  await registerUser(page, credentials);

  await page.goto('/buildings');
  await expect(page.locator('h1')).toContainText(/B.timents/);

  const buildButtons = page.getByRole('button', { name: /Construire niveau/ });
  const total = await buildButtons.count();
  let clicked = false;

  for (let index = 0; index < total; index += 1) {
    const button = buildButtons.nth(index);
    if (await button.isEnabled()) {
      await button.click();
      clicked = true;
      break;
    }
  }

  expect(clicked).toBe(true);
  await expect(page.getByText('File de construction')).toBeVisible();
});
