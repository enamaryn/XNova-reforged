import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

async function promoteToAdmin(username: string) {
  await prisma.user.update({
    where: { username },
    data: { role: 'ADMIN' },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('acces panneau admin', async ({ page }) => {
  const credentials = buildCredentials('e2e_admin');

  await registerUser(page, credentials);

  // Promouvoir l'utilisateur en admin
  await promoteToAdmin(credentials.username);

  await page.goto('/admin');

  // Vérifier que la page admin se charge correctement
  await expect(page.getByRole('heading', { name: /Vue g.n.rale/ })).toBeVisible();
  await expect(page.getByText(/Configuration/)).toBeVisible();
});

test('modification configuration serveur', async ({ page }) => {
  const credentials = buildCredentials('e2e_admincfg');

  await registerUser(page, credentials);

  await promoteToAdmin(credentials.username);

  await page.goto('/admin');

  // Vérifier que les champs de configuration sont présents
  await expect(page.getByText(/Vitesse du jeu|Game Speed/)).toBeVisible();
  await expect(page.getByText(/Vitesse des flottes|Fleet Speed/)).toBeVisible();

  // Vérifier que le bouton de sauvegarde est présent
  const saveButton = page.getByRole('button', { name: /Sauvegarder|Save/ });
  await expect(saveButton).toBeVisible();
});

test('acces refuse pour joueur normal', async ({ page }) => {
  const credentials = buildCredentials('e2e_player');

  await registerUser(page, credentials);

  // Tenter d'accéder au panneau admin sans droits
  await page.goto('/admin');

  // Devrait afficher le message d'accès refusé
  await expect(page.getByText(/Acc.s r.serv. aux administrateurs/)).toBeVisible();
});
