import { test, expect } from '@playwright/test';

test('inscription et acces a la vue d ensemble', async ({ page }) => {
  const seed = Date.now();
  const username = `e2e_${seed}`;
  const email = `e2e_${seed}@xnova.local`;

  await page.goto('/register');
  await page.fill('#username', username);
  await page.fill('#email', email);
  await page.fill('#password', 'Test1234');
  await page.getByRole('button', { name: 'Creer mon compte' }).click();

  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: "Vue d'ensemble" })).toBeVisible();

  await page.goto('/galaxy');
  await expect(page.getByRole('heading', { name: 'Galaxie' })).toBeVisible();
});
