import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
  await prisma.$disconnect();
});

test('administration : un admin simple n\'a pas l\'onglet Configurer SMTP', async ({ page }) => {
  const adminCredentials = buildCredentials('e2e_adm');
  await registerUser(page, adminCredentials);
  await prisma.user.update({ where: { username: adminCredentials.username }, data: { role: 'ADMIN' } });
  await page.goto('/admin');
  await expect(page.getByRole('tab', { name: 'Général' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Configurer SMTP' })).toHaveCount(0);
});

test('administration : le super admin configure SMTP', async ({ page }) => {
  await prisma.gameConfig.deleteMany({ where: { key: { startsWith: 'smtp.' } } });
  const superCredentials = buildCredentials('e2e_sadm');
  await registerUser(page, superCredentials);
  await prisma.user.update({ where: { username: superCredentials.username }, data: { role: 'SUPER_ADMIN' } });
  await page.goto('/admin');

  await page.getByRole('tab', { name: 'Configurer SMTP' }).click();
  await expect(page.getByTestId('smtp-panel')).toBeVisible();

  await page.getByLabel('Hôte SMTP').fill('smtp.example.org');
  await page.getByLabel('Port SMTP').fill('587');
  await page.getByLabel('Identifiant SMTP').fill('mailer');
  await page.getByLabel('Mot de passe SMTP').fill('tres-secret-e2e');
  await page.getByLabel("Adresse d'expédition").fill('jeu@example.org');
  // L'envoi reste désactivé : un autre test E2E vérifie le refus sans SMTP actif (tests en parallèle)
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByTestId('smtp-notice')).toContainText('Configuration SMTP enregistrée');
  // Le mot de passe n'est jamais réaffiché ; le champ est vidé
  await expect(page.getByLabel('Mot de passe SMTP')).toHaveValue('');
  await expect(page.locator('body')).not.toContainText('tres-secret-e2e');

  const stored = await prisma.gameConfig.findUniqueOrThrow({ where: { key: 'smtp.password' } });
  expect(stored.value.startsWith('enc:v1:')).toBe(true);
  expect(stored.value).not.toContain('tres-secret-e2e');

  // Rechargement : les valeurs persistent
  await page.reload();
  await page.getByRole('tab', { name: 'Configurer SMTP' }).click();
  await expect(page.getByLabel('Hôte SMTP')).toHaveValue('smtp.example.org');
  await expect(page.getByLabel("Activer l'envoi d'emails")).not.toBeChecked();
});
