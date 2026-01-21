import type { Page } from '@playwright/test';

export function buildCredentials(prefix: string) {
  const sanitized = (prefix || 'e2e').replace(/[^a-zA-Z0-9_-]/g, '');
  const safePrefix = sanitized.length >= 3 ? sanitized.slice(0, 10) : 'e2e';
  const suffix = Math.random().toString(36).slice(2, 8);
  const username = `${safePrefix}_${suffix}`.slice(0, 20);
  const email = `${username}@xnova.local`;

  return { username, email };
}

/**
 * Inscription d'un utilisateur avec attente de l'hydration React.
 * Attend que le formulaire soit interactif avant de remplir les champs.
 */
export async function registerUser(
  page: Page,
  credentials: { username: string; email: string; password?: string }
) {
  const { username, email, password = 'Test1234' } = credentials;

  await page.goto('/register');

  // Attendre que le formulaire soit hydraté et interactif
  const usernameInput = page.locator('#username');
  await usernameInput.waitFor({ state: 'visible' });

  // Attendre que l'input soit vraiment interactif (hydration React terminée)
  await page.waitForFunction(() => {
    const input = document.querySelector('#username') as HTMLInputElement;
    return input && !input.disabled;
  });

  // Remplir les champs avec des petites pauses pour la stabilité
  await usernameInput.fill(username);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  // Cliquer sur le bouton de soumission
  await page.getByRole('button', { name: 'Creer mon compte' }).click();

  // Attendre la redirection vers /overview
  await page.waitForURL(/\/overview$/);
}

/**
 * Connexion d'un utilisateur existant.
 */
export async function loginUser(
  page: Page,
  credentials: { identifier: string; password?: string }
) {
  const { identifier, password = 'Test1234' } = credentials;

  await page.goto('/login');

  const identifierInput = page.locator('#identifier');
  await identifierInput.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const input = document.querySelector('#identifier') as HTMLInputElement;
    return input && !input.disabled;
  });

  await identifierInput.fill(identifier);
  await page.locator('#password').fill(password);

  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/overview$/);
}
