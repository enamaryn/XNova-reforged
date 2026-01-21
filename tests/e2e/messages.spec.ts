import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

async function seedRecipient(seed: number) {
  // Créer un utilisateur destinataire pour les messages
  const recipient = await prisma.user.create({
    data: {
      username: `e2e_recipient_${seed}`,
      email: `e2e_recipient_${seed}@xnova.local`,
      password: 'seeded',
      points: 0,
      rank: 0,
    },
  });

  return recipient.username;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('formulaire envoi message', async ({ page }) => {
  const credentials = buildCredentials('e2e_msg');

  await registerUser(page, credentials);

  await page.goto('/messages');

  // Attendre que la page charge
  await page.waitForLoadState('networkidle');

  // Vérifier que le formulaire d'envoi est présent
  await expect(page.getByPlaceholder(/Destinataire/)).toBeVisible();
  await expect(page.getByPlaceholder(/Sujet/)).toBeVisible();
  await expect(page.getByPlaceholder(/Votre message|Your message/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Envoyer/ })).toBeVisible();
});

test('affichage boite de reception', async ({ page }) => {
  const credentials = buildCredentials('e2e_inbox');

  await registerUser(page, credentials);

  await page.goto('/messages');
  await expect(page.locator('h1')).toContainText(/Messages/);

  // Vérifier que la boîte de réception est affichée
  await expect(page.getByText(/Bo.te de r.ception|Inbox/)).toBeVisible();
});
