import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { LEGAL_VERSION } from '@xnova/game-config';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("inscription : la case des conditions est obligatoire, puis l'acceptation est enregistrée", async ({ page }) => {
  const credentials = buildCredentials('e2e_terms');
  await page.goto('/register');
  await page.locator('#username').waitFor({ state: 'visible' });
  await page.locator('#username').fill(credentials.username);
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill('Test1234');
  await page.getByRole('button', { name: 'Creer mon compte' }).click();
  await expect(page.getByText("Vous devez accepter les conditions d'utilisation")).toBeVisible();
  expect(await prisma.user.count({ where: { username: credentials.username } })).toBe(0);

  await page.locator('#acceptTerms').check();
  await page.getByRole('button', { name: 'Creer mon compte' }).click();
  await page.waitForURL(/\/overview$/);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username } });
  expect(user.termsVersion).toBe(LEGAL_VERSION);
  expect(user.termsAcceptedAt).not.toBeNull();
  await expect(page.getByTestId('terms-banner')).toHaveCount(0);
});

test("compte antérieur : bandeau d'acceptation, un clic l'enregistre", async ({ page }) => {
  const credentials = buildCredentials('e2e_oldacc');
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { termsAcceptedAt: null, termsVersion: null } });

  await page.reload();
  const banner = page.getByTestId('terms-banner');
  await expect(banner).toBeVisible();
  await page.getByTestId('terms-accept').click();
  await expect(banner).toHaveCount(0);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username } });
  expect(user.termsVersion).toBe(LEGAL_VERSION);
});

test('suppression du compte : confirmation, mot de passe, puis connexion impossible', async ({ page }) => {
  const credentials = buildCredentials('e2e_delete');
  await registerUser(page, credentials);

  await page.goto('/settings');
  const form = page.getByTestId('delete-account');
  await expect(form).toBeVisible();
  const submit = page.getByTestId('delete-submit');
  await expect(submit).toBeDisabled();

  // Mauvais mot de passe : refusé, le compte reste
  await form.getByLabel('Votre mot de passe, pour confirmer').fill('Mauvais12345');
  await page.getByTestId('delete-confirm').check();
  await submit.click();
  await expect(page.getByTestId('delete-notice')).toContainText('Mot de passe incorrect');
  expect(await prisma.user.count({ where: { username: credentials.username } })).toBe(1);

  // Bon mot de passe : compte supprimé, retour à l'accueil
  await form.getByLabel('Votre mot de passe, pour confirmer').fill('Test1234');
  await submit.click();
  await page.waitForURL((url) => !url.pathname.includes('/settings'));
  expect(await prisma.user.count({ where: { username: credentials.username } })).toBe(0);

  await page.goto('/login');
  await page.locator('#identifier').waitFor({ state: 'visible' });
  await page.locator('#identifier').fill(credentials.username);
  await page.locator('#password').fill('Test1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/incorrect|invalide|Identifiants/i).first()).toBeVisible();
});
