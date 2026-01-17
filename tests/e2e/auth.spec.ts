import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';

test('inscription et acces a la vue d ensemble', async ({ page }) => {
  const credentials = buildCredentials('e2e');

  await registerUser(page, credentials);

  await expect(page.getByRole('heading', { name: "Vue d'ensemble" })).toBeVisible();

  await page.goto('/galaxy');
  await expect(page.getByRole('heading', { name: 'Galaxie' })).toBeVisible();
});
