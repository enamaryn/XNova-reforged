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

test('liste, recherche, fiche et bannissement/débannissement des joueurs', async ({ page, browser }) => {
  const playerCredentials = buildCredentials('e2e_target');
  const playerContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try { await registerUser(await playerContext.newPage(), playerCredentials); }
  finally { await playerContext.close(); }
  const player = await prisma.user.findUniqueOrThrow({ where: { username: playerCredentials.username }, include: { planets: true } });
  await prisma.planet.update({ where: { id: player.planets[0].id }, data: { crystalMine: 4, solarPlant: 10 } });
  const adminCredentials = buildCredentials('e2e_padmin');
  await registerUser(page, adminCredentials);
  await promoteToAdmin(adminCredentials.username);
  await page.goto('/admin');
  await expect(page.getByRole('spinbutton', { name: 'Jours', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Heures', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Minutes', exact: true })).toBeVisible();
  await expect(page.getByText(/Tout à zéro = bannissement permanent/)).toBeVisible();
  await page.getByRole('tab', { name: 'Joueurs', exact: true }).click();
  await page.getByLabel('Rechercher par pseudo').fill(playerCredentials.username.toUpperCase());
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await page.getByRole('button', { name: `Voir la fiche de ${playerCredentials.username}` }).click();
  const detail = page.getByRole('region', { name: `Fiche de ${playerCredentials.username}` });
  await expect(detail.getByRole('heading', { name: 'Technologies', exact: true })).toBeVisible();
  await expect(detail.getByText('Mine de Cristal', { exact: true }).locator('..')).toContainText('Niv. 4');
  await expect(detail.getByLabel('Adresse email', { exact: true })).toHaveValue(playerCredentials.email);
  await expect(detail.getByText(/connexion reste bloquée jusqu’à confirmation/)).toBeVisible();
  await page.getByRole('button', { name: `Bannir ${playerCredentials.username}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Débannir ${playerCredentials.username}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Débannir ${playerCredentials.username}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Bannir ${playerCredentials.username}`, exact: true })).toBeVisible();
});
