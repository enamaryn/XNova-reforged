import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';

test('affichage statistiques', async ({ page }) => {
  const credentials = buildCredentials('e2e_stats');

  await registerUser(page, credentials);

  await page.goto('/statistics');

  // Attendre que la page charge
  await page.waitForLoadState('networkidle');

  // Vérifier le titre
  await expect(page.locator('h1')).toContainText(/Statistiques/);

  // Vérifier que les sections principales sont visibles (fr: "Vos stats", "Top joueurs", "Top alliances")
  await expect(page.getByText(/Vos stats|Your stats/)).toBeVisible();
  await expect(page.getByText(/Top joueurs|Top players/)).toBeVisible();
  await expect(page.getByText(/Top alliances/)).toBeVisible();
});
