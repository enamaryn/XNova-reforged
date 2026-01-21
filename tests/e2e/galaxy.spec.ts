import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';

test('navigation galaxie', async ({ page }) => {
  const credentials = buildCredentials('e2e_galaxy');

  await registerUser(page, credentials);

  await page.goto('/galaxy');
  await expect(page.locator('h1')).toContainText(/Galaxie/);

  // Vérifier que les sélecteurs de galaxie et système sont présents
  const galaxyInput = page.locator('input[type="number"]').first();
  await expect(galaxyInput).toBeVisible();

  // Vérifier qu'au moins une position est affichée (les 15 positions d'un système)
  const positions = page.locator('[class*="rounded-2xl"]').filter({ hasText: /1:1:/ });
  await expect(positions.first()).toBeVisible();

  // Vérifier que le bouton Coloniser est présent pour une position libre
  const colonizeButton = page.getByRole('button', { name: /Coloniser/ });
  const colonizeCount = await colonizeButton.count();

  // Il devrait y avoir au moins une position libre à coloniser
  expect(colonizeCount).toBeGreaterThan(0);
});
