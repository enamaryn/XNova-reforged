import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@xnova/database';
import { buildCredentials, loginUser, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

/** Crée directement un jeton comme le ferait le serveur (seule l'empreinte est stockée). */
async function issueToken(username: string, type: string, email: string | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  const token = randomBytes(32).toString('base64url');
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      type,
      email,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return token;
}

test('mot de passe oublié : réponse générique, puis réinitialisation par le lien', async ({ page }) => {
  const credentials = buildCredentials('e2e_reset');
  await registerUser(page, credentials);
  await page.context().clearCookies();

  await page.goto('/forgot-password');
  await page.getByLabel('Adresse email').fill('inconnu@example.test');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  await expect(page.getByTestId('forgot-sent')).toContainText('Si un compte correspond');

  // Le lien de l'email (jeton émis comme par le serveur)
  const token = await issueToken(credentials.username, 'reset_password', null);
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('NouveauPass123');
  await page.getByLabel('Confirmation').fill('Different12345');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByTestId('form-error')).toContainText('ne correspondent pas');

  await page.getByLabel('Confirmation').fill('NouveauPass123');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByTestId('reset-done')).toBeVisible();

  // Le lien ne sert qu'une fois
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Encore12345Pass');
  await page.getByLabel('Confirmation').fill('Encore12345Pass');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByTestId('form-error')).toContainText('invalide ou expiré');

  await loginUser(page, { identifier: credentials.username, password: 'NouveauPass123' });
});

test('confirmation de l\'adresse par le lien, visible dans les paramètres', async ({ page }) => {
  const credentials = buildCredentials('e2e_verify');
  await registerUser(page, credentials);

  await page.goto('/settings');
  await expect(page.getByTestId('email-status')).toHaveText('Non confirmée');

  const token = await issueToken(credentials.username, 'verify_email', credentials.email);
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByTestId('verify-result')).toContainText('Adresse email confirmée');

  await page.goto('/settings');
  await expect(page.getByTestId('email-status')).toHaveText('Confirmée');

  await page.goto('/verify-email?token=jeton-inconnu-jeton-inconnu-jeton');
  await expect(page.getByTestId('verify-result')).toContainText('invalide ou expiré');
});

test('paramètres : changer le mot de passe (erreur puis succès)', async ({ page }) => {
  const credentials = buildCredentials('e2e_chgpwd');
  await registerUser(page, credentials);
  await page.goto('/settings');

  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('Mauvais12345');
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('NouveauPass123');
  await page.getByLabel('Confirmation du nouveau mot de passe').fill('NouveauPass123');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByTestId('password-notice')).toContainText('incorrect');

  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('Test1234');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByTestId('password-notice')).toContainText('Mot de passe modifié');
  // La session courante reste utilisable
  await page.reload();
  await expect(page.getByTestId('account-email')).toContainText(credentials.email);
});

test('paramètres : changer d\'adresse sans SMTP configuré affiche l\'erreur du serveur', async ({ page }) => {
  await prisma.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
  const credentials = buildCredentials('e2e_chgmail');
  await registerUser(page, credentials);
  await page.goto('/settings');

  await page.getByLabel('Nouvelle adresse email').fill(`nouvelle_${credentials.username}@example.test`);
  await page.getByLabel("Mot de passe actuel (changement d'adresse)").fill('Test1234');
  await page.getByRole('button', { name: 'Envoyer la confirmation' }).click();
  await expect(page.getByTestId('email-notice')).toContainText("n'est pas configuré");
});
