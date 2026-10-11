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

  await expect(page.getByRole('tab', { name: 'Joueurs', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Général', exact: true }).click();

  // Vérifier que la page admin se charge correctement
  await expect(page.getByRole('heading', { name: /Vue g.n.rale/ })).toBeVisible();
  await expect(page.getByText(/Configuration/)).toBeVisible();
});

test('modification configuration serveur', async ({ page }) => {
  const credentials = buildCredentials('e2e_admincfg');

  await registerUser(page, credentials);

  await promoteToAdmin(credentials.username);

  await page.goto('/admin');

  await page.getByRole('tab', { name: 'Général', exact: true }).click();

  // Vérifier que les champs de configuration sont présents
  await expect(page.getByText(/Vitesse du jeu|Game Speed/)).toBeVisible();
  await expect(page.getByText(/Vitesse des flottes|Fleet Speed/)).toBeVisible();

  // Vérifier que le bouton de sauvegarde est présent
  const saveButton = page.getByRole('button', { name: /Sauvegarder|Save/ });
  await expect(saveButton).toBeVisible();
});

test('profil de vitesse de référence : le bouton remplit le formulaire sans sauvegarder', async ({ page }) => {
  const credentials = buildCredentials('e2e_adminprof');

  await registerUser(page, credentials);
  await promoteToAdmin(credentials.username);

  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Général', exact: true }).click();

  const speed = page.locator('label', { hasText: /Vitesse du jeu/ }).locator('input');
  await expect(speed).toBeVisible();
  await page.getByTestId('apply-speed-profile').click();

  // Le profil ×50 est appliqué au formulaire ; rien n'est enregistré (les autres parcours gardent leur réglage)
  await expect(speed).toHaveValue('50');
  await expect(page.locator('label', { hasText: /Vitesse des flottes/ }).locator('input')).toHaveValue('50');
  await expect(page.locator('label', { hasText: /Multiplicateur batiments/ }).locator('input')).toHaveValue('1');
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
  await page.getByLabel('Rechercher par pseudo').fill(playerCredentials.username.toUpperCase());
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await page.getByRole('link', { name: `Voir la fiche de ${playerCredentials.username}` }).click();
  const detail = page.getByRole('region', { name: `Fiche de ${playerCredentials.username}` });
  await expect(detail.getByRole('heading', { name: 'Technologies', exact: true })).toBeVisible();
  await expect(detail.getByText('Mine de Cristal', { exact: true }).locator('..')).toContainText('Niv. 4');
  await expect(detail.getByLabel('Adresse email', { exact: true })).toHaveValue(playerCredentials.email);
  await expect(detail.getByText(/connexion reste bloquée jusqu’à confirmation/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: `Fiche de ${playerCredentials.username}` })).toBeVisible();
  for (const action of ['Bannir', 'Débannir']) {
    await page.getByRole('button', { name: action, exact: true }).click();
    await page.getByLabel('Motif', { exact: true }).fill('Test de modération');
    await page.getByLabel(`Retapez le pseudo ${playerCredentials.username} pour confirmer`).fill(playerCredentials.username);
    await page.getByRole('button', { name: `Confirmer ${action.toLowerCase()}`, exact: true }).click();
    await expect(page.getByRole('button', { name: action === 'Bannir' ? 'Débannir' : 'Bannir', exact: true })).toBeVisible();
  }
});
