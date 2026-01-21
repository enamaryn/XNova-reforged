import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser, loginUser } from './helpers';

test('inscription et acces a la vue d ensemble', async ({ page }) => {
  const credentials = buildCredentials('e2e');

  await registerUser(page, credentials);

  await expect(page.getByRole('heading', { name: "Vue d'ensemble" })).toBeVisible();

  await page.goto('/galaxy');
  await expect(page.getByRole('heading', { name: 'Galaxie' })).toBeVisible();
});

test('inscription puis connexion', async ({ page }) => {
  const credentials = buildCredentials('e2e_login');
  const password = 'Test1234';

  await registerUser(page, { ...credentials, password });
  await expect(page.getByRole('heading', { name: "Vue d'ensemble" })).toBeVisible();

  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await loginUser(page, { identifier: credentials.username, password });
  await expect(page.getByRole('heading', { name: "Vue d'ensemble" })).toBeVisible();
});
