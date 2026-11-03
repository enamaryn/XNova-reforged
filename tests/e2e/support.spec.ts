import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('la page de support est publique : contact, conseils, FAQ, invitation à se connecter', async ({ page }) => {
  await page.goto('/fr/support');
  await expect(page.getByRole('heading', { level: 1, name: 'Support et signalement de bugs' })).toBeVisible();
  await expect(page.getByTestId('support-contact')).toBeVisible();
  await expect(page.getByTestId('support-login')).toBeVisible();
  await expect(page.getByTestId('support-form-section').getByRole('textbox')).toHaveCount(0);
  await expect(page.getByTestId('support-page').getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', /faq$/);

  // Lien du pied de page, et titre traduit dans une autre langue
  await page.goto('/fr/faq');
  await page.getByTestId('footer-support').click();
  await expect(page).toHaveURL(/\/fr\/support$/);
  await page.goto('/de/support');
  await expect(page.getByRole('heading', { level: 1, name: 'Support und Fehlermeldungen' })).toBeVisible();
});

test("un joueur signale un bug depuis le jeu, un administrateur le traite et le joueur voit l'état", async ({ page, browser }) => {
  const player = buildCredentials('e2e_sup');
  await registerUser(page, player);

  // Dans le cadre du jeu (menu de gauche)
  await page.goto('/assistance');
  await expect(page.getByTestId('support-page')).toBeVisible();
  const submit = page.getByTestId('support-submit');
  await expect(submit).toBeDisabled();
  await page.getByTestId('support-kind').selectOption('bug');
  await page.getByTestId('support-subject').fill('La file se fige');
  await page.getByTestId('support-body').fill('Le compte à rebours reste bloqué après avoir lancé une mine de métal.');
  await submit.click();
  await expect(page.getByTestId('support-notice')).toContainText('signalement envoyé');
  await expect(page.getByTestId('support-mine')).toContainText('La file se fige');
  await expect(page.getByTestId('support-mine').getByTestId('support-status-new')).toBeVisible();

  const row = await prisma.supportReport.findFirstOrThrow({ where: { user: { username: player.username } } });
  expect(row).toMatchObject({ kind: 'bug', status: 'new', pagePath: '/fr/assistance' });
  expect(row.appVersion).toBeTruthy();

  // Un administrateur (autre session) lit puis traite le signalement
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const admin = buildCredentials('e2e_supadm');
  await registerUser(adminPage, admin);
  await prisma.user.update({ where: { username: admin.username }, data: { role: 'ADMIN' } });
  await adminPage.goto('/admin');
  await expect(adminPage.getByTestId('support-new-badge')).toBeVisible();
  await adminPage.getByTestId('admin-tab-support').click();
  const card = adminPage.getByTestId(`support-report-${row.id}`);
  await expect(card).toContainText('La file se fige');
  await expect(card).toContainText(player.username);
  await expect(card).toContainText('/fr/assistance');

  // Réponse intégrée : enregistrée sur le signalement et envoyée en message au joueur
  await card.getByTestId('support-reply-open').click();
  await card.getByTestId('support-reply-text').fill('Merci, nous corrigeons cela dans la prochaine mise à jour.');
  await card.getByTestId('support-reply-send').click();
  // Le signalement passe de « Nouveau » à « Lu » : il quitte la vue par défaut
  await expect(card).toHaveCount(0);
  await adminPage.getByTestId('support-filter').selectOption('seen');
  await expect(card.getByTestId('support-report-status')).toHaveText('Lu');
  await expect(card.getByTestId('support-admin-replies')).toContainText('prochaine mise à jour');
  const message = await prisma.message.findFirstOrThrow({ where: { to: { username: player.username } } });
  expect(message).toMatchObject({ subject: 'Support : La file se fige', read: false });

  await card.getByTestId('support-resolve').click();
  await expect.poll(async () => (await prisma.supportReport.findUnique({ where: { id: row.id } }))?.status).toBe('resolved');
  await adminContext.close();

  // Le joueur voit le nouvel état
  await page.reload();
  await expect(page.getByTestId('support-mine').getByTestId('support-status-resolved')).toBeVisible();
  await expect(page.getByTestId('support-reply')).toContainText('prochaine mise à jour');
});

test("un joueur ordinaire n'a pas l'onglet Support de la console", async ({ page }) => {
  const player = buildCredentials('e2e_supnoadm');
  await registerUser(page, player);
  await page.goto('/admin');
  await expect(page.getByTestId('admin-tab-support')).toHaveCount(0);
  await expect(page.getByTestId('support-panel')).toHaveCount(0);
});
