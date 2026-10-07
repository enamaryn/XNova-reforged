import { test, expect } from '@playwright/test';
import { FakeSmtp } from '../../apps/api/test/integration/fake-smtp';

/**
 * SETUP-01 : déroule l'assistant d'installation sur une base neuve. Les autres parcours E2E en dépendent
 * (l'inscription est refusée tant que l'installation n'est pas terminée). Ignoré si le serveur est déjà installé.
 * Le serveur API doit être démarré avec SETUP_TOKEN (code d'installation connu des tests).
 */
const SETUP_TOKEN = process.env.SETUP_TOKEN ?? 'E2E0-SETU-PCOD-E123';
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

const smtp = new FakeSmtp();

test.beforeAll(async () => {
  await smtp.start();
});
test.afterAll(async () => {
  await smtp.stop();
});

test("assistant d'installation : du code au verrouillage", async ({ page, request }) => {
  const status = await request.get(`${API_URL}/setup/status`);
  const installed = !(await status.json()).setupRequired;
  test.skip(installed, 'Serveur déjà installé');

  await page.goto('/setup');
  await expect(page.getByTestId('setup-wizard')).toBeVisible();

  // Mauvais code, puis bon code
  await page.locator('#setup-code').fill('AAAA-AAAA-AAAA-AAAA');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByTestId('setup-error')).toBeVisible();
  await page.locator('#setup-code').fill(SETUP_TOKEN);
  await page.getByRole('button', { name: 'Continuer' }).click();

  // SMTP + test d'envoi
  await page.locator('#smtp-host').fill('127.0.0.1');
  await page.locator('#smtp-port').fill(String(smtp.port));
  await page.locator('#smtp-from').fill('noreply@xnova.local');
  await page.getByRole('button', { name: 'Enregistrer la configuration' }).click();
  await page.locator('#smtp-test-to').fill('admin@xnova.local');
  await page.getByRole('button', { name: "Envoyer l'email de test" }).click();
  await expect(page.getByText('réussi ✓')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).last().click();

  // Réglages (valeurs par défaut)
  await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();

  // Super admin
  await page.locator('#admin-username').fill('superadmin');
  await page.locator('#admin-email').fill('admin@xnova.local');
  await page.locator('#admin-password').fill('SuperAdmin123');
  await page.locator('#admin-confirmation').fill('SuperAdmin123');
  await page.getByRole('button', { name: 'Créer le compte et envoyer le lien' }).click();
  await expect(page.getByTestId('setup-validation')).toBeVisible();

  // Validation : clic sur le lien reçu par email
  const mail = await smtp.waitFor('admin@xnova.local', 15_000);
  const link = mail.body.match(/https?:\/\/[^\s"<>]+\/verify-email\?token=[A-Za-z0-9_-]+/);
  expect(link).not.toBeNull();
  const verifyPage = await page.context().newPage();
  await verifyPage.goto(new URL(link![0]).pathname + new URL(link![0]).search);
  // Attendre le résultat : fermer la page trop tôt annulerait la requête de confirmation (hydratation lente en CI)
  await expect(verifyPage.getByTestId('verify-result')).toContainText('Adresse email confirmée', { timeout: 60_000 });
  await verifyPage.close();

  // L'assistant se met à jour tout seul, puis disparaît
  await expect(page.getByTestId('setup-done')).toBeVisible({ timeout: 30_000 });
  const after = await request.get(`${API_URL}/setup/status`);
  expect((await after.json()).setupRequired).toBe(false);
});
