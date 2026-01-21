import { test, expect } from '@playwright/test';
import { buildCredentials, registerUser } from './helpers';

test('acces page alliance', async ({ page }) => {
  const credentials = buildCredentials('e2e_ally');

  await registerUser(page, credentials);

  await page.goto('/alliance');

  // Attendre que la page se charge (soit le contenu soit un indicateur de chargement)
  await page.waitForLoadState('networkidle');

  // Vérifier qu'on est bien sur la page alliance (heading ou lien dans sidebar)
  const allianceLink = page.getByRole('link', { name: /Alliance/ });
  await expect(allianceLink).toBeVisible();
});
