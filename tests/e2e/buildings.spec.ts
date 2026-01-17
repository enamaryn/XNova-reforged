import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';

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
