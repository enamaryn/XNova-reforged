import { test, expect } from '@playwright/test';

test('construction batiment', async ({ page }) => {
  const seed = Date.now();
  const username = `e2e_build_${seed}`;
  const email = `e2e_${seed}@xnova.local`;

  await page.goto('/register');
  await page.fill('#username', username);
  await page.fill('#email', email);
  await page.fill('#password', 'Test1234');
  await page.getByRole('button', { name: 'Creer mon compte' }).click();

  await expect(page).toHaveURL(/\/overview$/);

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
